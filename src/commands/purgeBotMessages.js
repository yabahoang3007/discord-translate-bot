const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const logger = require("../logger");
const { confirmDestructiveAction } = require("../services/confirmAction");

const DEFAULT_SCAN_LIMIT = 2000;
const MAX_SCAN_LIMIT = 10000;
// bulkDelete chi xoa duoc tin nhan < 14 ngay tuoi; chua 1 gio du phong cho lech dong ho.
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;

const data = new SlashCommandBuilder()
  .setName("purge-bot-messages")
  .setDescription("Xóa tin nhắn của một bot/webhook trong kênh hiện tại (bỏ trống để xem danh sách bot)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addUserOption((opt) => opt.setName("bot").setDescription("Bot cần xóa tin nhắn (vd: Top Heroes)"))
  .addStringOption((opt) =>
    opt.setName("author_id").setDescription("ID tác giả nếu là webhook/kênh follow (lấy từ danh sách khi bỏ trống)")
  )
  .addIntegerOption((opt) =>
    opt
      .setName("scan_limit")
      .setDescription(`Số tin nhắn gần nhất cần quét (mặc định ${DEFAULT_SCAN_LIMIT})`)
      .setMinValue(100)
      .setMaxValue(MAX_SCAN_LIMIT)
  );

// Chi tin nhan cua bot/webhook moi duoc tinh - tranh xoa nham tin nhan cua nguoi that.
function isBotAuthored(message) {
  return message.author.bot || Boolean(message.webhookId);
}

async function fetchHistory(channel, limit) {
  const result = [];
  let before;
  while (result.length < limit) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, limit - result.length), before });
    if (batch.size === 0) break;
    result.push(...batch.values());
    before = batch.last().id;
  }
  return result;
}

async function listBotAuthors(interaction, scanLimit) {
  await interaction.deferReply({ ephemeral: true });
  const history = await fetchHistory(interaction.channel, scanLimit);
  const authors = new Map();
  for (const message of history) {
    if (!isBotAuthored(message) || message.author.id === interaction.client.user.id) continue;
    const entry = authors.get(message.author.id) || { name: message.author.username, count: 0 };
    entry.count += 1;
    authors.set(message.author.id, entry);
  }

  if (authors.size === 0) {
    await interaction.editReply(`Không thấy tin nhắn nào của bot/webhook trong ${history.length} tin nhắn gần nhất.`);
    return;
  }

  const lines = [...authors.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, { name, count }]) => `• **${name}** — ${count} tin nhắn — \`author_id:${id}\``);
  await interaction.editReply(
    [`Bot/webhook trong ${history.length} tin nhắn gần nhất:`, ...lines, "", "Chạy lại lệnh kèm `author_id` để xóa."]
      .join("\n")
      .slice(0, 2000)
  );
}

async function deleteMessages(channel, messages) {
  const cutoff = Date.now() - BULK_DELETE_MAX_AGE_MS;
  const recent = messages.filter((m) => m.createdTimestamp > cutoff);
  const old = messages.filter((m) => m.createdTimestamp <= cutoff);

  let deleted = 0;
  for (let i = 0; i < recent.length; i += 100) {
    const chunk = recent.slice(i, i + 100);
    if (chunk.length === 1) {
      await chunk[0].delete();
      deleted += 1;
    } else {
      const result = await channel.bulkDelete(chunk, true);
      deleted += result.size;
    }
  }

  // Tin nhan cu hon 14 ngay phai xoa tung cai (discord.js tu xu ly rate limit).
  let failed = 0;
  for (const message of old) {
    try {
      await message.delete();
      deleted += 1;
    } catch (error) {
      failed += 1;
      logger.warn(`Không xóa được tin nhắn ${message.id}:`, error.message);
    }
  }
  return { deleted, failed };
}

async function execute(interaction) {
  const botUser = interaction.options.getUser("bot");
  const authorIdInput = interaction.options.getString("author_id")?.trim();
  const scanLimit = interaction.options.getInteger("scan_limit") || DEFAULT_SCAN_LIMIT;

  if (!botUser && !authorIdInput) {
    await listBotAuthors(interaction, scanLimit);
    return;
  }

  if (botUser && !botUser.bot) {
    await interaction.reply({ content: "Lệnh này chỉ xóa tin nhắn của **bot**, không áp dụng cho thành viên.", ephemeral: true });
    return;
  }

  const targetId = botUser?.id || authorIdInput.replace(/\D/g, "");
  if (!targetId) {
    await interaction.reply({ content: "`author_id` không hợp lệ.", ephemeral: true });
    return;
  }
  if (targetId === interaction.client.user.id) {
    await interaction.reply({ content: "Không dùng lệnh này để xóa tin nhắn của chính bot dịch.", ephemeral: true });
    return;
  }

  const targetLabel = botUser ? `**${botUser.username}**` : `tác giả \`${targetId}\``;
  const confirmed = await confirmDestructiveAction(interaction, {
    prompt: `Bạn sắp xóa **mọi** tin nhắn của ${targetLabel} trong ${scanLimit} tin nhắn gần nhất của kênh <#${interaction.channelId}>.`,
  });
  if (!confirmed) return;

  try {
    await interaction.editReply({ content: `🔎 Đang quét ${scanLimit} tin nhắn gần nhất...`, components: [] });
    const history = await fetchHistory(interaction.channel, scanLimit);
    const targets = history.filter((m) => m.author.id === targetId && isBotAuthored(m));

    if (targets.length === 0) {
      await interaction.editReply(`Không tìm thấy tin nhắn nào của ${targetLabel} trong ${history.length} tin nhắn gần nhất.`);
      return;
    }

    await interaction.editReply(`🗑️ Đang xóa ${targets.length} tin nhắn của ${targetLabel}...`);
    const { deleted, failed } = await deleteMessages(interaction.channel, targets);
    logger.info(`[purge] Đã xóa ${deleted}/${targets.length} tin nhắn của ${targetId} trong kênh ${interaction.channelId}`);
    await interaction.editReply(
      `✅ Đã xóa ${deleted}/${targets.length} tin nhắn của ${targetLabel}.` +
        (failed ? ` ${failed} tin nhắn không xóa được (xem log).` : "")
    );
  } catch (error) {
    logger.error("[purge] Lỗi khi xóa tin nhắn:", error);
    await interaction.editReply(
      `❌ Lỗi khi xóa: ${error.message}. Kiểm tra bot có quyền **Manage Messages** và **Read Message History** ở kênh này.`
    );
  }
}

module.exports = { data, execute };
