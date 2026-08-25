const { SlashCommandBuilder } = require("discord.js");
const memberListStore = require("../config/memberList");

const data = new SlashCommandBuilder()
  .setName("showlist")
  .setDescription("Xem nhanh danh sách thành viên đã đăng ký tên");

async function execute(interaction) {
  const { entries } = memberListStore.getConfig();

  const lines = entries.length
    ? entries.map((e, i) => `${i + 1}. ${e.name} — <@${e.userId}>`).join("\n")
    : "_Chưa có ai đăng ký. Gõ `!Tên của bạn` để đăng ký._";

  await interaction.reply({
    content: `📋 **Danh Sách Thành Viên Đã Đăng Ký** (${entries.length} người)\n${lines}`,
    ephemeral: true,
  });
}

module.exports = { data, execute };
