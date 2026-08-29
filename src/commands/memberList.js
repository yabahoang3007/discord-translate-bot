const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const memberListStore = require("../config/memberList");
const { updateMemberListEverywhere } = require("../handlers/memberListHandler");
const { confirmDestructiveAction } = require("../services/confirmAction");

const data = new SlashCommandBuilder()
  .setName("member-list")
  .setDescription("Quản lý danh sách thành viên đăng ký tên qua cú pháp !name")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub.setName("setchannel").setDescription("Đặt kênh hiện tại làm nơi nhận đăng ký !name")
  )
  .addSubcommand((sub) => sub.setName("reset").setDescription("Xóa toàn bộ danh sách đã đăng ký"));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "setchannel") {
    memberListStore.setChannel(interaction.channelId);
    await interaction.deferReply({ ephemeral: true });
    await updateMemberListEverywhere(interaction.client, memberListStore.getConfig().entries);
    await interaction.editReply(
      "Đã đặt kênh này làm nơi đăng ký. Thành viên chỉ cần gõ `!Tên của họ` để tham gia danh sách — danh sách sẽ hiện ở kênh này và mọi kênh trong hệ thống đồng bộ đa ngôn ngữ."
    );
    return;
  }

  if (subcommand === "reset") {
    const confirmed = await confirmDestructiveAction(interaction, {
      prompt: "Bạn sắp xóa **toàn bộ** danh sách thành viên đã đăng ký tên (và các tin nhắn danh sách đã ghim).",
    });
    if (!confirmed) return;

    memberListStore.reset();
    await interaction.editReply({
      content: "Đã xóa toàn bộ danh sách thành viên đã đăng ký.",
      components: [],
    });
  }
}

module.exports = { data, execute };
