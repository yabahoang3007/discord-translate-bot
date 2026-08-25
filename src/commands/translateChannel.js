const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const configStore = require("../config/store");

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

  if (subcommand === "reset") {
    configStore.resetChannelRules();
    await interaction.reply({ content: "Đã xóa mọi giới hạn kênh. Bot sẽ dịch ở mọi kênh.", ephemeral: true });
    return;
  }

  if (subcommand === "status") {
    const enabled = configStore.isChannelEnabled(channelId);
    await interaction.reply({
      content: enabled ? "Kênh này đang được tự động dịch." : "Kênh này đang bị loại trừ khỏi tự động dịch.",
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };
