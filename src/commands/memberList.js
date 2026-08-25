const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const memberListStore = require("../config/memberList");
const { updateMemberListEverywhere } = require("../handlers/memberListHandler");

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
    memberListStore.reset();
    await interaction.reply({ content: "Đã xóa toàn bộ danh sách thành viên đã đăng ký.", ephemeral: true });
  }
}

module.exports = { data, execute };
