const { EmbedBuilder } = require("discord.js");
const logger = require("../logger");
const configStore = require("../config/store");
const gemini = require("../services/geminiTranslate");
const { extractTranslatable, restorePlaceholders, isTranslatable } = require("../services/textSanitizer");
const { describeLanguage } = require("../services/languageCatalog");

const EMBED_COLOR = 0xf1c40f;
// Gioi han cua Discord: description 4096 ky tu/embed, toi da 10 embed va 6000 ky tu/tin nhan.
const EMBED_DESCRIPTION_MAX = 4096;
const EMBEDS_PER_MESSAGE = 10;
const CHARS_PER_MESSAGE = 6000;

function baseLang(code) {
  return (code || "").split("-")[0].toLowerCase();
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

// Bot game (Top Heroes...) thuong dang thong bao dang embed, content de trong -> gom ca
// content lan noi dung chu trong embed thanh 1 khoi van ban de dich.
function collectText(message) {
  const parts = [];
  if (message.content) parts.push(message.content);
  for (const embed of message.embeds) {
    if (embed.author?.name) parts.push(embed.author.name);
    if (embed.title) parts.push(`**${embed.title}**`);
    if (embed.description) parts.push(embed.description);
    for (const field of embed.fields || []) parts.push(`**${field.name}**\n${field.value}`);
    if (embed.footer?.text) parts.push(embed.footer.text);
  }
  return parts.join("\n\n").trim();
}

// Chia cac embed thanh nhieu tin nhan sao cho moi tin nhan khong vuot gioi han Discord.
function packEmbeds(embeds) {
  const messages = [];
  let current = [];
  let currentChars = 0;
  for (const embed of embeds) {
    const size = (embed.data.author?.name?.length || 0) + (embed.data.description?.length || 0);
    if (current.length >= EMBEDS_PER_MESSAGE || (current.length > 0 && currentChars + size > CHARS_PER_MESSAGE)) {
      messages.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(embed);
    currentChars += size;
  }
  if (current.length > 0) messages.push(current);
  return messages;
}

// Tra ve true neu tin nhan nam trong kenh thong bao (da xu ly, bat ke thanh cong hay khong).
async function tryHandleAnnouncement(message) {
  if (!configStore.getAnnouncementChannels().includes(message.channel.id)) return false;
  // Chi dich tin nhan cua bot/webhook khac; nguoi that chat trong kenh nay thi bo qua.
  if (!message.author.bot && !message.webhookId) return true;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return true;

  const config = configStore.getConfig();
  if (config.languages.length === 0) return true;

  const { cleanText, placeholders } = extractTranslatable(collectText(message));
  if (!isTranslatable(cleanText, config.minMessageLength)) return true;

  let result;
  try {
    result = await gemini.translateMessage(cleanText, config.languages, apiKey);
  } catch (error) {
    logger.warn("[announcement] Gemini dịch thất bại, bỏ qua thông báo này:", error.message || error);
    return true;
  }

  const sourceBase = baseLang(result.detectedLanguage);
  const embeds = Object.entries(result.translations || {})
    .filter(([code, text]) => Boolean(text) && baseLang(code) !== sourceBase)
    .map(([code, text]) => {
      const lang = config.languages.find((l) => l.code === code) || describeLanguage(code);
      return new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setAuthor({ name: `${lang.flag} ${lang.name}` })
        .setDescription(truncate(restorePlaceholders(text, placeholders), EMBED_DESCRIPTION_MAX));
    });

  if (embeds.length === 0) return true;

  try {
    const [first, ...rest] = packEmbeds(embeds);
    await message.reply({ embeds: first, allowedMentions: { parse: [], repliedUser: false } });
    for (const batch of rest) {
      await message.channel.send({ embeds: batch, allowedMentions: { parse: [] } });
    }
  } catch (error) {
    logger.error("[announcement] Không gửi được bản dịch thông báo:", error.message || error);
  }
  return true;
}

module.exports = { tryHandleAnnouncement };
