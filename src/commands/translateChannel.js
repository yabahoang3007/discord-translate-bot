const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const configStore = require("../config/store");
const { confirmDestructiveAction } = require("../services/confirmAction");

const data = new SlashCommandBuilder()
  .setName("translate-channel")
  .setDescription("Quản lý kênh nào được bot tự động dịch")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub.setName("ignore").setDescription("Bật/tắt loại trừ kênh này khỏi tự động dịch")
  )
  .addSubcommand((sub) =>
    sub.setName("only").setDescription("Bật/tắt: chỉ dịch trong danh sách các kênh 'only' này")
  )
  .addSubcommand((sub) =>
    sub
      .setName("announcement")
      .setDescription("Bật/tắt: dịch tin nhắn của bot khác (vd Top Heroes) trong kênh thông báo này")
  )
  .addSubcommand((sub) => sub.setName("reset").setDescription("Xóa mọi giới hạn kênh (dịch ở mọi kênh)"))
  .addSubcommand((sub) => sub.setName("status").setDescription("Xem trạng thái dịch của kênh hiện tại"));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const channelId = interaction.channelId;

  if (subcommand === "ignore") {
    const isNowIgnored = configStore.toggleIgnoredChannel(channelId);
    await interaction.reply({
      content: isNowIgnored ? "Đã loại trừ kênh này khỏi tự động dịch." : "Đã bật lại tự động dịch cho kênh này.",
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "only") {
    const isNowOnly = configStore.toggleOnlyChannel(channelId);
    await interaction.reply({
      content: isNowOnly
        ? "Đã thêm kênh này vào danh sách 'only' (khi danh sách này không rỗng, bot CHỈ dịch trong các kênh đó)."
        : "Đã bỏ kênh này khỏi danh sách 'only'.",
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "announcement") {
    const isNowAnnouncement = configStore.toggleAnnouncementChannel(channelId);
    await interaction.reply({
      content: isNowAnnouncement
        ? "Đã bật chế độ kênh thông báo: tin nhắn của bot/webhook khác trong kênh này sẽ được dịch sang mọi ngôn ngữ đang cấu hình."
        : "Đã tắt chế độ kênh thông báo cho kênh này.",
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "reset") {
    const confirmed = await confirmDestructiveAction(interaction, {
      prompt: "Bạn sắp xóa **mọi** giới hạn kênh dịch (cả danh sách 'ignore' lẫn 'only'). Sau đó bot sẽ dịch ở mọi kênh.",
    });
    if (!confirmed) return;

    configStore.resetChannelRules();
    await interaction.editReply({ content: "Đã xóa mọi giới hạn kênh. Bot sẽ dịch ở mọi kênh.", components: [] });
    return;
  }

  if (subcommand === "status") {
    const enabled = configStore.isChannelEnabled(channelId);
    const isAnnouncement = configStore.getAnnouncementChannels().includes(channelId);
    await interaction.reply({
      content: [
        enabled ? "Kênh này đang được tự động dịch." : "Kênh này đang bị loại trừ khỏi tự động dịch.",
        isAnnouncement ? "Đây là kênh thông báo: tin nhắn của bot khác cũng được dịch." : null,
      ]
        .filter(Boolean)
        .join("\n"),
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };
