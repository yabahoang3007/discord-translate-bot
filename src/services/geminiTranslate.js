const logger = require("../logger");
const TtlCache = require("./ttlCache");
const { RateLimiter } = require("./rateLimiter");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]); // KHONG retry 429: tra ve ngay de khong pha them quota mien phi

const translationCache = new TtlCache(60 * 60 * 1000); // 1 gio
const rateLimiter = new RateLimiter(Number(process.env.GEMINI_RPM_LIMIT) || 15);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSystemPrompt(languages) {
  const list = languages.map((lang) => `${lang.code} (${lang.name})`).join(", ");
  return [
    "Bạn là công cụ dịch thuật chuyên nghiệp cho một cộng đồng Discord quốc tế, nhiều thành viên đến từ nhiều quốc gia.",
    `Danh sách ngôn ngữ đích cần hỗ trợ: ${list}.`,
    "Với đoạn văn bản người dùng gửi, hãy:",
    "1. Xác định chính xác ngôn ngữ gốc (trả về mã ISO 639-1; dùng biến thể như zh-CN/zh-TW khi cần phân biệt).",
    "2. Dịch sang TỪNG ngôn ngữ đích ở trên, TRỪ ngôn ngữ trùng với ngôn ngữ gốc đã xác định (bỏ qua, không cần điền).",
    "3. Ưu tiên chính xác về thuật ngữ và đúng ngữ cảnh hơn là dịch từng từ theo nghĩa đen; giữ đúng giọng văn, sắc thái trang trọng/thân mật/hài hước của bản gốc.",
    "4. Các chuỗi dạng ⟦P0⟧, ⟦P1⟧, ⟦P2⟧... là placeholder đại diện cho link, mention, emoji hoặc code — PHẢI giữ nguyên y hệt, không dịch, không thêm/bớt khoảng trắng quanh chúng, không đổi thứ tự hay số thứ tự.",
    "Chỉ trả lời đúng theo JSON schema đã cho, không thêm giải thích, không thêm markdown.",
  ].join("\n");
}

function buildResponseSchema(languages) {
  const properties = {};
  for (const lang of languages) {
    properties[lang.code] = { type: "STRING", description: `Bản dịch sang ${lang.name} (${lang.code})` };
  }
  return {
    type: "OBJECT",
    properties: {
      detectedLanguage: {
        type: "STRING",
        description: "Mã ngôn ngữ gốc phát hiện được (ISO 639-1 hoặc BCP-47)",
      },
      translations: {
        type: "OBJECT",
        properties,
        description: "Bản dịch theo từng mã ngôn ngữ đích; bỏ qua field nếu trùng ngôn ngữ gốc",
      },
    },
    required: ["detectedLanguage", "translations"],
  };
}

function buildRelaySystemPrompt(sourceLangName, languages) {
  const list = languages.map((lang) => `${lang.code} (${lang.name})`).join(", ");
  return [
    "Bạn là công cụ dịch thuật cho một hệ thống cầu nối chat đa kênh trên Discord — mỗi kênh ứng với 1 ngôn ngữ.",
    `Đoạn văn bản này đến từ kênh ngôn ngữ "${sourceLangName}" — coi đây LUÔN LUÔN là ngôn ngữ nguồn, bất kể nội dung thực tế trông giống ngôn ngữ nào.`,
    `Dịch nó sang TỪNG ngôn ngữ đích sau, PHẢI điền đủ tất cả, không được bỏ trống bất kỳ ngôn ngữ nào: ${list}.`,
    "Ngay cả khi văn bản gốc tình cờ trùng hoặc lẫn từ ngữ của một trong các ngôn ngữ đích, vẫn phải dịch/chuyển thể đầy đủ sang đúng ngôn ngữ đó.",
    "Ưu tiên chính xác ngữ cảnh và thuật ngữ hơn là dịch từng từ theo nghĩa đen; giữ đúng giọng văn, sắc thái của bản gốc.",
    "Các chuỗi dạng ⟦P0⟧, ⟦P1⟧... là placeholder — giữ nguyên y hệt, không dịch, không đổi thứ tự hay khoảng trắng quanh chúng.",
    "Chỉ trả lời đúng theo JSON schema đã cho, không thêm giải thích, không thêm markdown.",
  ].join("\n");
}

function buildRelaySchema(languages) {
  const properties = {};
  for (const lang of languages) {
    properties[lang.code] = { type: "STRING", description: `Bản dịch sang ${lang.name} (${lang.code})` };
  }
  return { type: "OBJECT", properties, required: languages.map((lang) => lang.code) };
}

async function callGeminiRaw(body, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      lastError = networkError;
      await sleep(2 ** attempt * 400);
      continue;
    }

    if (response.status === 429) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Đã đạt giới hạn tốc độ/quota miễn phí của Gemini API: ${errorBody}`);
    }

    if (response.ok) {
      return response.json();
    }

    const errorBody = await response.text().catch(() => "");
    lastError = new Error(`Gemini API lỗi ${response.status}: ${errorBody}`);

    if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_RETRIES) {
      throw lastError;
    }

    await sleep(2 ** attempt * 400);
  }

  throw lastError;
}

function extractJson(raw) {
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = raw?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini từ chối phản hồi: ${blockReason}` : "Phản hồi từ Gemini rỗng.");
  }
  try {
    return JSON.parse(text);
  } catch (parseError) {
    throw new Error(`Không parse được JSON từ Gemini: ${parseError.message}`);
  }
}

/**
 * Phat hien ngon ngu goc + dich sang tat ca ngon ngu dich trong 1 lan goi API.
 * @returns {Promise<{ detectedLanguage: string, translations: Record<string, string> }>}
 */
async function translateMessage(cleanText, languages, apiKey) {
  const cacheKey = `${languages.map((l) => l.code).sort().join(",")}::${cleanText}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt(languages) }] },
    contents: [{ role: "user", parts: [{ text: cleanText }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(languages),
    },
  };

  const raw = await rateLimiter.schedule(() => callGeminiRaw(body, apiKey));
  const parsed = extractJson(raw);

  if (!parsed.detectedLanguage || typeof parsed.translations !== "object") {
    throw new Error("JSON trả về từ Gemini thiếu trường bắt buộc.");
  }

  translationCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * Dich cho he thong cau noi da kenh: ngon ngu nguon la CO DINH theo kenh (khong tu
 * detect), va LUON dich du sang moi ngon ngu dich duoc liet ke, khong bao gio bo qua
 * du noi dung thuc te trung voi ngon ngu dich nao.
 * @returns {Promise<Record<string, string>>}
 */
async function translateForRelay(cleanText, sourceLangName, languages, apiKey) {
  const cacheKey = `relay:${sourceLangName}::${languages.map((l) => l.code).sort().join(",")}::${cleanText}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const body = {
    system_instruction: { parts: [{ text: buildRelaySystemPrompt(sourceLangName, languages) }] },
    contents: [{ role: "user", parts: [{ text: cleanText }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: buildRelaySchema(languages),
    },
  };

  const raw = await rateLimiter.schedule(() => callGeminiRaw(body, apiKey));
  const parsed = extractJson(raw);

  translationCache.set(cacheKey, parsed);
  return parsed;
}

function getCacheStats() {
  return { translationCacheSize: translationCache.size };
}

module.exports = { translateMessage, translateForRelay, getCacheStats };
