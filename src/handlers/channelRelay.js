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

  const rawContent = message.content.trim();
  const hasRawContent = rawContent.length > 0;
  const stickers = [...message.stickers.values()];
  const hasStickers = stickers.length > 0;
  const attachments = [...message.attachments.values()];
  const hasAttachments = attachments.length > 0;

  if (!hasRawContent && !hasStickers && !hasAttachments) return true;

  const otherMappings = mappings.filter((m) => m.channelId !== message.channel.id);
  if (otherMappings.length === 0) return true;

  const { cleanText, placeholders } = extractTranslatable(message.content);
  const shouldTranslate = hasRawContent && isTranslatable(cleanText);

  // null = khong dich duoc (hoac khong can dich) -> gui nguyen van cho moi kenh thay vi bo qua.
  let translatedByCode = null;
  if (shouldTranslate) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const sourceLangInfo = describeLanguage(current.code);
      // Dung DU danh sach ngon ngu (khong chi "cac kenh con lai") de moi tin nhan trong
      // cung 1 batch (xem geminiTranslate.js) dung chung 1 bo ngon ngu dich, bat ke tin
      // nhan do den tu kenh nao - dieu kien can de gop nhieu tin nhan vao 1 request.
      const targetLanguages = mappings.map((m) => describeLanguage(m.code));
      try {
        const translations = await gemini.translateForRelay(cleanText, sourceLangInfo.name, targetLanguages, apiKey);
        translatedByCode = {};
        for (const [code, text] of Object.entries(translations)) {
          translatedByCode[code] = restorePlaceholders(text, placeholders);
        }
      } catch (error) {
        logger.warn("Đồng bộ kênh thất bại (lỗi dịch), sẽ gửi nguyên văn thay thế:", error.message || error);
      }
    }
  }

  const stickerFiles = hasStickers ? await downloadStickerFiles(stickers) : [];
  // Anh/GIF/video dinh kem: dung thang URL cua Discord CDN, khong can tu tai ve.
  const attachmentFiles = attachments.map((a) => ({ attachment: a.url, name: a.name || "file" }));
  const mediaFiles = [...stickerFiles, ...attachmentFiles];

  const displayName = message.member?.displayName || message.author.username;
  const avatarURL = message.author.displayAvatarURL();
  const client = message.client;

  const group = [{ channelId: message.channel.id, messageId: message.id }];

  // Gui song song sang tat ca kenh con lai thay vi tuan tu - voi 6-7 kenh, gui tuan tu
  // moi kenh ~200-500ms se cong don thanh vai giay tre khong can thiet.
  const sendResults = await Promise.allSettled(
    otherMappings.map(async (mapping) => {
      const text = translatedByCode ? translatedByCode[mapping.code] : hasRawContent ? rawContent : undefined;
      if (!text && mediaFiles.length === 0) return null;

      const targetChannel = await client.channels.fetch(mapping.channelId);
      const webhook = await getOrCreateWebhook(targetChannel, client);
      const sent = await webhook.send({
        content: text || undefined,
        files: mediaFiles.length ? mediaFiles : undefined,
        username: displayName,
        avatarURL,
      });
      return { channelId: mapping.channelId, messageId: sent.id };
    })
  );

  for (const [index, result] of sendResults.entries()) {
    if (result.status === "fulfilled" && result.value) {
      group.push(result.value);
    } else if (result.status === "rejected") {
      logger.error(`Không gửi được tin nhắn đồng bộ sang kênh ${otherMappings[index].channelId}:`, result.reason?.message);
    }
  }

  if (group.length > 1) relayLinks.registerGroup(group);

  return true;
}

module.exports = { tryHandleChannelRelay };
