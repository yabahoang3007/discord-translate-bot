const { SlashCommandBuilder } = require("discord.js");
const configStore = require("../config/store");
const userPreferences = require("../config/userPreferences");
const { describeLanguage } = require("../services/languageCatalog");

const data = new SlashCommandBuilder()
  .setName("mute-language")
  .setDescription("Chọn ngôn ngữ bạn KHÔNG muốn tin nhắn của mình được dịch sang")
  .addSubcommand((sub) =>
    sub
      .setName("toggle")
      .setDescription("Bật/tắt mute cho một ngôn ngữ đối với tin nhắn của bạn")
      .addStringOption((opt) =>
        opt.setName("code").setDescription("Mã ngôn ngữ, ví dụ: de, ja, en").setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("Xem danh sách ngôn ngữ bạn đang mute"));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (subcommand === "list") {
    const muted = userPreferences.getMutedLanguages(userId);
    const text = muted.length
      ? muted.map((code) => describeLanguage(code)).map((l) => `${l.flag} ${l.name} (${l.code})`).join("\n")
      : "Bạn chưa mute ngôn ngữ nào — tin nhắn của bạn đang được dịch sang tất cả ngôn ngữ của server.";
    await interaction.reply({ content: text, ephemeral: true });
    return;
  }

  if (subcommand === "toggle") {
    const rawCode = interaction.options.getString("code", true);
    const info = describeLanguage(rawCode);

    const configuredCodes = configStore.getLanguages().map((lang) => lang.code);
    if (!configuredCodes.includes(info.code)) {
      await interaction.reply({
        content: `Ngôn ngữ \`${rawCode}\` không nằm trong danh sách ngôn ngữ server đang dùng (${configuredCodes.join(", ")}).`,
        ephemeral: true,
      });
      return;
    }

    const nowMuted = userPreferences.toggleMutedLanguage(userId, info.code);
    await interaction.reply({
      content: nowMuted
        ? `Đã mute ${info.flag} ${info.name} — từ giờ tin nhắn của bạn sẽ KHÔNG được dịch sang ngôn ngữ này nữa.`
        : `Đã bỏ mute ${info.flag} ${info.name} — tin nhắn của bạn sẽ được dịch sang ngôn ngữ này trở lại.`,
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };
