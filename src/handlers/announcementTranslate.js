const logger = require("../logger");
const configStore = require("../config/store");
const channelLanguages = require("../config/channelLanguages");
const gemini = require("../services/geminiTranslate");
const { extractTranslatable, restorePlaceholders, isTranslatable } = require("../services/textSanitizer");
const { describeLanguage } = require("../services/languageCatalog");
const { getOrCreateWebhook } = require("../services/webhookRelay");

// Gioi han cua Discord: noi dung text 2000 ky tu/tin nhan, ten webhook toi da 80 ky tu.
const CONTENT_MAX = 2000;
const WEBHOOK_NAME_MAX = 80;

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

// Chia text dai thanh nhieu tin <= 2000 ky tu, uu tien cat o ranh gioi dong.
function splitForDiscord(text) {
  const chunks = [];
  let current = "";
  for (const line of text.split("\n")) {
    let rest = line;
    while (rest.length > CONTENT_MAX) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(rest.slice(0, CONTENT_MAX));
      rest = rest.slice(CONTENT_MAX);
    }
    const candidate = current ? `${current}\n${rest}` : rest;
    if (candidate.length > CONTENT_MAX) {
      chunks.push(current);
      current = rest;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

// Gui ban dich toi TUNG kenh (kenh tieng Viet
// nhan ban tieng Viet...), gia lam chinh bot thong bao qua webhook. Bo qua kenh trung ngon ngu
// goc (vd thong bao tieng Anh -> khong gui vao kenh en/#general). Dich loi ngon ngu nao thi bo
// kenh do, khong bao gio do nguyen van ngon ngu goc vao kenh ban dia.
async function forwardToLanguageChannels(message, mappings, cleanText, placeholders, apiKey) {
  const config = configStore.getConfig();
  const languages = mappings.map((m) => config.languages.find((l) => l.code === m.code) || describeLanguage(m.code));

  let result;
  try {
    result = await gemini.translateMessage(cleanText, languages, apiKey);
  } catch (error) {
    logger.warn("[announcement] Gemini dịch thất bại, bỏ qua thông báo này:", error.message || error);
    return;
  }

  const sourceBase = baseLang(result.detectedLanguage);
  const targets = mappings.filter((m) => baseLang(m.code) !== sourceBase);
  const files = [...message.attachments.values()].map((a) => ({ attachment: a.url, name: a.name || "file" }));
  const username = truncate(message.member?.displayName || message.author.username, WEBHOOK_NAME_MAX);
  const avatarURL = message.author.displayAvatarURL();

  const results = await Promise.allSettled(
    targets.map(async (mapping) => {
      const translated = result.translations?.[mapping.code];
      if (!translated) throw new Error(`thiếu bản dịch ${mapping.code}`);

      const chunks = splitForDiscord(`${restorePlaceholders(translated, placeholders)}\n-# 📢 ${message.url}`);
      const channel = await message.client.channels.fetch(mapping.channelId);
      const webhook = await getOrCreateWebhook(channel, message.client);
      for (const [index, chunk] of chunks.entries()) {
        const isLast = index === chunks.length - 1;
        await webhook.send({
          content: chunk,
          files: isLast && files.length ? files : undefined,
          username,
          avatarURL,
          allowedMentions: { parse: [] },
        });
      }
    })
  );

  for (const [index, outcome] of results.entries()) {
    if (outcome.status === "rejected") {
      logger.error(`[announcement] Không gửi được sang kênh ${targets[index].channelId}:`, outcome.reason?.message);
    }
  }
  const sent = results.filter((r) => r.status === "fulfilled").length;
  logger.info(`[announcement] Đã gửi bản dịch thông báo ${message.id} tới ${sent}/${targets.length} kênh ngôn ngữ.`);
}

// Tra ve true neu tin nhan nam trong kenh thong bao (da xu ly, bat ke thanh cong hay khong).
async function tryHandleAnnouncement(message) {
  if (!configStore.getAnnouncementChannels().includes(message.channel.id)) return false;
  // Chi dich tin nhan cua bot/webhook khac; nguoi that chat trong kenh nay thi bo qua.
  if (!message.author.bot && !message.webhookId) return true;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return true;

  const { cleanText, placeholders } = extractTranslatable(collectText(message));
  if (!isTranslatable(cleanText, configStore.getConfig().minMessageLength)) return true;

  // Chua co kenh theo ngon ngu (/language-channels setup) thi khong co noi nao de gui -> bo qua.
  const mappings = channelLanguages.getMappings();
  if (mappings.length > 0) await forwardToLanguageChannels(message, mappings, cleanText, placeholders, apiKey);
  return true;
}

module.exports = { tryHandleAnnouncement };
