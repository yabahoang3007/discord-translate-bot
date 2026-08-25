const { StickerFormatType } = require("discord.js");
const logger = require("../logger");
const channelLanguages = require("../config/channelLanguages");
const gemini = require("../services/geminiTranslate");
const { extractTranslatable, restorePlaceholders, isTranslatable } = require("../services/textSanitizer");
const { describeLanguage } = require("../services/languageCatalog");
const { getOrCreateWebhook } = require("../services/webhookRelay");
const relayLinks = require("../services/relayLinks");

// Discord KHONG cho phep webhook gui sticker that (chi bot/user that gui truc tiep moi duoc),
// nen ta tai anh cua sticker ve va gui lai duoi dang file dinh kem. Sticker Lottie (.json, dang
// animated cao cap) khong the chuyen thanh anh don gian nen bi bo qua.
async function downloadStickerFiles(stickers) {
  const files = [];
  for (const sticker of stickers) {
    if (sticker.format === StickerFormatType.Lottie) continue;
    try {
      const response = await fetch(sticker.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = sticker.format === StickerFormatType.GIF ? "gif" : "png";
      files.push({ attachment: buffer, name: `${sticker.name}.${ext}` });
    } catch (error) {
      logger.error(`Không tải được sticker ${sticker.name}:`, error.message);
    }
  }
  return files;
}

// Tra ve true neu kenh nay la kenh-theo-ngon-ngu (da xu ly, bat ke thanh cong hay khong),
// de messageCreate.js biet ma bo qua luong dich kieu reply-embed cu cho kenh nay.
async function tryHandleChannelRelay(message) {
  const mappings = channelLanguages.getMappings();
  const current = mappings.find((m) => m.channelId === message.channel.id);
  if (!current) return false;

  const { cleanText, placeholders } = extractTranslatable(message.content);
  const hasText = isTranslatable(cleanText);
  const stickers = [...message.stickers.values()];
  const hasStickers = stickers.length > 0;

  if (!hasText && !hasStickers) return true;

  const otherMappings = mappings.filter((m) => m.channelId !== message.channel.id);
  if (otherMappings.length === 0) return true;

  let translations = {};
  if (hasText) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const sourceLangInfo = describeLanguage(current.code);
      const targetLanguages = otherMappings.map((m) => describeLanguage(m.code));
      try {
        translations = await gemini.translateForRelay(cleanText, sourceLangInfo.name, targetLanguages, apiKey);
      } catch (error) {
        logger.warn("Đồng bộ kênh thất bại (lỗi dịch):", error.message || error);
      }
    }
  }

  const stickerFiles = hasStickers ? await downloadStickerFiles(stickers) : [];
  if (hasText && Object.keys(translations).length === 0 && stickerFiles.length === 0) return true;

  const displayName = message.member?.displayName || message.author.username;
  const avatarURL = message.author.displayAvatarURL();
  const client = message.client;

  const group = [{ channelId: message.channel.id, messageId: message.id }];

  for (const mapping of otherMappings) {
    const text = translations?.[mapping.code];
    if (!text && stickerFiles.length === 0) continue;

    try {
      const targetChannel = await client.channels.fetch(mapping.channelId);
      const webhook = await getOrCreateWebhook(targetChannel, client);
      const sent = await webhook.send({
        content: text ? restorePlaceholders(text, placeholders) : undefined,
        files: stickerFiles.length ? stickerFiles : undefined,
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
