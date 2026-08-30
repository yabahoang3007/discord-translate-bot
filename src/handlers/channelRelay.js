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

const QUOTE_MAX_LENGTH = 100;

function truncateQuote(text) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > QUOTE_MAX_LENGTH ? `${singleLine.slice(0, QUOTE_MAX_LENGTH - 3)}...` : singleLine;
}

// Discord KHONG cho phep webhook tao reply that (field message_reference bi lang le bo qua),
// nen ta hien thi phan trich dan tin nhan duoc tra loi bang text ngay tren noi dung chinh.
// Neu tin nhan duoc tra loi cung tung duoc dong bo (con trong relayLinks), dung dung ban da
// DICH sang ngon ngu cua tung kenh dich thay vi hien nguyen van ngoai ngu goc.
async function resolveReplyContext(message) {
  if (!message.reference?.messageId) return null;
  try {
    const repliedTo = await message.fetchReference();
    return {
      authorName: repliedTo.member?.displayName || repliedTo.author.username,
      originalContent: repliedTo.content || "[tệp đính kèm/sticker]",
      group: relayLinks.getGroup(repliedTo.id),
    };
  } catch {
    return null;
  }
}

async function buildReplyPrefix(replyContext, targetChannelId, client) {
  if (!replyContext) return "";

  let quoteText = replyContext.originalContent;
  const matched = replyContext.group?.find((g) => g.channelId === targetChannelId);
  if (matched) {
    try {
      const targetChannel = await client.channels.fetch(targetChannelId);
      const translatedCopy = await targetChannel.messages.fetch(matched.messageId);
      if (translatedCopy.content) quoteText = translatedCopy.content;
    } catch {
      // giu nguyen quoteText mac dinh (chua dich) neu khong lay duoc ban da dich
    }
  }

  return `> 💬 **${replyContext.authorName}**: ${truncateQuote(quoteText)}\n`;
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

  logger.info(
    `[relay] kênh ${current.code} (${message.channel.id}) -> ${otherMappings.length} kênh khác | ` +
      `shouldTranslate=${shouldTranslate} hasApiKey=${Boolean(process.env.GEMINI_API_KEY)} cleanText=${JSON.stringify(
        cleanText.slice(0, 80)
      )}`
  );

  // translatedByCode == null co 2 truong hop rat khac nhau:
  //  - translationFailed = false: noi dung KHONG can dich (so, emoji, ky tu dac biet) -> gui as-is la dung.
  //  - translationFailed = true : da co gang dich nhung LOI (429, het quota, mat mang...) -> KHONG duoc
  //    do nguyen van ngon ngu goc vao cac kenh ban dia (gay "song ngu"); tha thieu tin con hon.
  let translatedByCode = null;
  let translationFailed = false;
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
        logger.info(`[relay] dịch OK, mã ngôn ngữ nhận được: ${Object.keys(translatedByCode).join(", ")}`);
      } catch (error) {
        translationFailed = true;
        logger.warn("[relay] Đồng bộ kênh thất bại (lỗi dịch), BỎ QUA text cho kênh bản địa:", error.message || error);
      }
    } else {
      translationFailed = true;
      logger.warn("[relay] THIẾU GEMINI_API_KEY trong môi trường -> bỏ qua text cho kênh bản địa.");
    }
  }

  const stickerFiles = hasStickers ? await downloadStickerFiles(stickers) : [];
  // Anh/GIF/video dinh kem: dung thang URL cua Discord CDN, khong can tu tai ve.
  const attachmentFiles = attachments.map((a) => ({ attachment: a.url, name: a.name || "file" }));
  const mediaFiles = [...stickerFiles, ...attachmentFiles];

  const displayName = message.member?.displayName || message.author.username;
  const avatarURL = message.author.displayAvatarURL();
  const client = message.client;
  const replyContext = await resolveReplyContext(message);

  const group = [{ channelId: message.channel.id, messageId: message.id }];

  // Gui song song sang tat ca kenh con lai thay vi tuan tu - voi 6-7 kenh, gui tuan tu
  // moi kenh ~200-500ms se cong don thanh vai giay tre khong can thiet.
  const sendResults = await Promise.allSettled(
    otherMappings.map(async (mapping) => {
      // - Dich thanh cong: dung ban dich cua dung ngon ngu kenh.
      // - Dich LOI (translationFailed): KHONG gui text (tha thieu con hon do ngoai ngu goc vao kenh ban dia);
      //   media/sticker van gui binh thuong vi chung khong co ngon ngu.
      // - Khong can dich (so, emoji...): gui as-is.
      let text;
      if (translatedByCode) text = translatedByCode[mapping.code];
      else if (translationFailed) text = undefined;
      else text = hasRawContent ? rawContent : undefined;

      if (!text && mediaFiles.length === 0) return null;

      const replyPrefix = await buildReplyPrefix(replyContext, mapping.channelId, client);
      const content = replyPrefix ? `${replyPrefix}${text || ""}`.trim() : text;

      const targetChannel = await client.channels.fetch(mapping.channelId);
      const webhook = await getOrCreateWebhook(targetChannel, client);
      const sent = await webhook.send({
        content: content || undefined,
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
