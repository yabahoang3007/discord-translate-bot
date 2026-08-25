const { SlashCommandBuilder } = require("discord.js");
const configStore = require("../config/store");
const gemini = require("../services/geminiTranslate");

const data = new SlashCommandBuilder()
  .setName("translate-status")
  .setDescription("Xem tình trạng cấu hình dịch thuật của bot");

async function execute(interaction) {
  const config = configStore.getConfig();
  const cacheStats = gemini.getCacheStats();
  const languages = config.languages.map((lang) => `${lang.flag} ${lang.name}`).join(", ") || "Chưa cấu hình";
  const channelMode =
    config.onlyChannels.length > 0
      ? `Chỉ dịch trong ${config.onlyChannels.length} kênh được chỉ định`
      : `Dịch ở mọi kênh trừ ${config.ignoredChannels.length} kênh bị loại trừ`;

  await interaction.reply({
    content: [
      `**Ngôn ngữ:** ${languages}`,
      `**Phạm vi kênh:** ${channelMode}`,
      `**Model:** ${process.env.GEMINI_MODEL || "gemini-3.6-flash"} (giới hạn ${
        process.env.GEMINI_RPM_LIMIT || 10
      } request/phút)`,
      `**Cache:** ${cacheStats.translationCacheSize} bản dịch đã lưu`,
    ].join("\n"),
    ephemeral: true,
  });
}

module.exports = { data, execute };
