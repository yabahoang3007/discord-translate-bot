const { EmbedBuilder } = require("discord.js");
const logger = require("../logger");
const memberListStore = require("../config/memberList");

const EMBED_COLOR = 0x5865f2;
const NAME_PATTERN = /^!(.+)/s;
const MAX_NAME_LENGTH = 80;

// Tra ve true neu tin nhan da duoc xu ly nhu 1 lan dang ky ten (bat ke thanh cong hay khong),
// de messageCreate.js biet ma bo qua buoc dich cho tin nhan nay.
async function tryHandleMemberRegistration(message) {
  const config = memberListStore.getConfig();
  if (!config.channelId || config.channelId !== message.channel.id) return false;

  const match = message.content.match(NAME_PATTERN);
  if (!match) return false;

  const name = match[1].trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return true; // da nhan dien la cu phap !name nhung khong hop le

  const entries = memberListStore.upsertEntry(message.author.id, name);
  await message.react("✅").catch(() => {});

  try {
    await updateMemberListMessage(message.channel, entries);
  } catch (error) {
    logger.error("Không cập nhật được tin nhắn danh sách thành viên:", error);
  }

  return true;
}

async function updateMemberListMessage(channel, entries) {
  const lines = entries.length
    ? entries.map((e, i) => `${i + 1}. ${e.name} — <@${e.userId}>`).join("\n")
    : "_Chưa có ai đăng ký._";

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("📋 Danh Sách Thành Viên Đã Đăng Ký")
    .setDescription(lines.length > 4000 ? `${lines.slice(0, 3997)}...` : lines)
    .setFooter({ text: `${entries.length} thành viên · Gõ !ten-cua-ban để đăng ký hoặc cập nhật tên` })
    .setTimestamp();

  const config = memberListStore.getConfig();

  if (config.messageId) {
    try {
      const existing = await channel.messages.fetch(config.messageId);
      await existing.edit({ embeds: [embed] });
      return;
    } catch {
      // Tin nhan cu bi xoa hoac khong tim thay -> tao tin nhan moi ben duoi.
    }
  }

  const posted = await channel.send({ embeds: [embed] });
  memberListStore.setMessageId(posted.id);
  await posted.pin().catch(() => {}); // best-effort, can quyen Manage Messages
}

module.exports = { tryHandleMemberRegistration, updateMemberListMessage };
