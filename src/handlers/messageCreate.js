const { EmbedBuilder } = require("discord.js");
const logger = require("../logger");
const configStore = require("../config/store");
const userPreferences = require("../config/userPreferences");
const gemini = require("../services/geminiTranslate");
const { extractTranslatable, restorePlaceholders, isTranslatable } = require("../services/textSanitizer");
const { describeLanguage } = require("../services/languageCatalog");
const { tryHandleMemberRegistration } = require("./memberListHandler");
const { tryHandleChannelRelay } = require("./channelRelay");

const EMBED_COLOR = 0x5865f2;

function baseLang(code) {
  return (code || "").split("-")[0].toLowerCase();
}

async function handleMessageCreate(message) {
  try {
    if (message.author.bot || message.webhookId || !message.guild) return;

    if (await tryHandleMemberRegistration(message)) return;
    if (await tryHandleChannelRelay(message)) return;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    const config = configStore.getConfig();
    if (!configStore.isChannelEnabled(message.channel.id)) return;
    if (config.languages.length < 2) return;

    const mutedByAuthor = new Set(userPreferences.getMutedLanguages(message.author.id));
    const targetLanguages = config.languages.filter((lang) => !mutedByAuthor.has(lang.code));
    if (targetLanguages.length === 0) return;

    const { cleanText, placeholders } = extractTranslatable(message.content);
    if (!isTranslatable(cleanText, config.minMessageLength)) return;

    let result;
    try {
      result = await gemini.translateMessage(cleanText, targetLanguages, apiKey);
    } catch (error) {
      logger.warn("Gemini dịch thất bại, bỏ qua tin nhắn này:", error.message || error);
      return;
    }

    const sourceBase = baseLang(result.detectedLanguage);
    const fields = Object.entries(result.translations || {})
      .filter(([code, text]) => Boolean(text) && baseLang(code) !== sourceBase)
      .map(([code, text]) => {
        const configured = config.languages.find((lang) => lang.code === code) || describeLanguage(code);
        const restored = restorePlaceholders(text, placeholders);
        return {
          name: `${configured.flag} ${configured.name}`,
          value: restored.length > 1024 ? `${restored.slice(0, 1021)}...` : restored,
        };
      });

    if (fields.length === 0) return;

    const sourceInfo = describeLanguage(result.detectedLanguage);
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setAuthor({
        name: message.member?.displayName || message.author.username,
        iconURL: message.author.displayAvatarURL(),
      })
      .addFields(fields)
      .setFooter({ text: `Phát hiện ngôn ngữ gốc: ${sourceInfo.flag} ${sourceInfo.name} • Gemini AI` })
      .setTimestamp();

    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  } catch (error) {
    logger.error("Lỗi khi xử lý messageCreate:", error);
  }
}

module.exports = { handleMessageCreate };
