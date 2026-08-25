const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const EMBED_COLOR = 0x5865f2;

const data = new SlashCommandBuilder()
  .setName("remind-setup")
  .setDescription("Nhắc mọi người khai báo tên trong game và ngôn ngữ/quốc gia (đăng kèm @everyone)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("📋 Nhắc nhở: Khai báo tên & ngôn ngữ / Reminder: Register your name & language")
    .setDescription(
      "**Tiếng Việt**\n" +
        "1️⃣ Khai báo tên: gõ `!Tên của bạn` ngay tại đây (ví dụ: `!Nguyễn Văn A`).\n" +
        "2️⃣ Khai báo ngôn ngữ/quốc gia: chạy `/declare-language language:<mã hoặc tên>` (ví dụ: `/declare-language language:French`) để có kênh chat riêng, tự động đồng bộ dịch với các kênh khác.\n\n" +
        "**English**\n" +
        "1️⃣ Register your name: type `!Your Name` right here (e.g. `!John Smith`).\n" +
        "2️⃣ Declare your language/country: run `/declare-language language:<code or name>` (e.g. `/declare-language language:French`) to get your own chat channel, auto-synced with the others."
    )
    .setFooter({ text: "Zen Assistant" });

  await interaction.reply({
    content: "@everyone",
    embeds: [embed],
    allowedMentions: { parse: ["everyone"] },
  });
}

module.exports = { data, execute };
