const logger = require("../logger");
const channelLanguages = require("../config/channelLanguages");
const gemini = require("../services/geminiTranslate");
const { extractTranslatable, restorePlaceholders, isTranslatable } = require("../services/textSanitizer");
const { describeLanguage } = require("../services/languageCatalog");
const { getOrCreateWebhook } = require("../services/webhookRelay");
const relayLinks = require("../services/relayLinks");

// Tra ve true neu kenh nay la kenh-theo-ngon-ngu (da xu ly, bat ke thanh cong hay khong),
// de messageCreate.js biet ma bo qua luong dich kieu reply-embed cu cho kenh nay.
async function tryHandleChannelRelay(message) {
  const mappings = channelLanguages.getMappings();
  const current = mappings.find((m) => m.channelId === message.channel.id);
  if (!current) return false;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return true;

  const { cleanText, placeholders } = extractTranslatable(message.content);
  if (!isTranslatable(cleanText)) return true;

  const otherMappings = mappings.filter((m) => m.channelId !== message.channel.id);
  if (otherMappings.length === 0) return true;

  const sourceLangInfo = describeLanguage(current.code);
  const targetLanguages = otherMappings.map((m) => describeLanguage(m.code));

  let translations;
  try {
    translations = await gemini.translateForRelay(cleanText, sourceLangInfo.name, targetLanguages, apiKey);
  } catch (error) {
    logger.warn("Đồng bộ kênh thất bại (lỗi dịch):", error.message || error);
    return true;
  }

  const displayName = message.member?.displayName || message.author.username;
  const avatarURL = message.author.displayAvatarURL();
  const client = message.client;

  const group = [{ channelId: message.channel.id, messageId: message.id }];

  for (const mapping of otherMappings) {
    const text = translations?.[mapping.code];
    if (!text) continue;

    try {
      const targetChannel = await client.channels.fetch(mapping.channelId);
      const webhook = await getOrCreateWebhook(targetChannel, client);
      const sent = await webhook.send({
        content: restorePlaceholders(text, placeholders),
        username: displayName,
        avatarURL,
      });
      group.push({ channelId: mapping.channelId, messageId: sent.id });
    } catch (error) {
      logger.error(`Không gửi được tin nhắn đồng bộ sang kênh ${mapping.channelId}:`, error.message);
    }
  }

  if (group.length > 1) relayLinks.registerGroup(group);

  return true;
}

module.exports = { tryHandleChannelRelay };
