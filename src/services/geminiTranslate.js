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

// Dung chung cho ca 2 prompt (che do 1 kenh va che do relay) de tang chat luong dich ma
// khong doi model - tranh dich may moc tung chu, giu dung sac thai/tieng long/ten rieng.
const TRANSLATION_QUALITY_GUIDE = [
  "Xử lý tiếng lóng, viết tắt, ngôn ngữ mạng (internet speak/teencode) một cách tự nhiên — dịch đúng Ý NGHĨA THỰC SỰ và sắc thái cảm xúc (đùa cợt, mỉa mai, bực bội, phấn khích...), tuyệt đối không dịch máy móc từng chữ.",
  "Tên riêng, tên nhân vật/nickname trong game, thuật ngữ chuyên ngành hoặc thuật ngữ riêng của cộng đồng: giữ nguyên không dịch nếu dịch ra sẽ làm mất nghĩa hoặc gây khó hiểu.",
  "Giữ nguyên mọi emoji trong bản dịch, không dịch hay loại bỏ emoji.",
  "Nếu câu có ẩn ý châm biếm, đùa giỡn, hoặc mỉa mai, phải truyền tải đúng tông giọng đó sang ngôn ngữ đích thay vì dịch nghiêm túc cứng nhắc.",
].join("\n");

function buildSystemPrompt(languages) {
  const list = languages.map((lang) => `${lang.code} (${lang.name})`).join(", ");
  return [
    "Bạn là công cụ dịch thuật chuyên nghiệp cho một cộng đồng Discord quốc tế, nhiều thành viên đến từ nhiều quốc gia.",
    `Danh sách ngôn ngữ đích cần hỗ trợ: ${list}.`,
    "Với đoạn văn bản người dùng gửi, hãy:",
    "1. Xác định chính xác ngôn ngữ gốc (trả về mã ISO 639-1; dùng biến thể như zh-CN/zh-TW khi cần phân biệt).",
    "2. Dịch sang TỪNG ngôn ngữ đích ở trên, TRỪ ngôn ngữ trùng với ngôn ngữ gốc đã xác định (bỏ qua, không cần điền).",
    "3. Ưu tiên chính xác về thuật ngữ và đúng ngữ cảnh hơn là dịch từng từ theo nghĩa đen; giữ đúng giọng văn, sắc thái trang trọng/thân mật/hài hước của bản gốc.",
    TRANSLATION_QUALITY_GUIDE,
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

// Batching: khi nhieu tin nhan (tu nhieu kenh/nguoi khac nhau) den gan nhau, gop chung
// vao 1 lan goi Gemini duy nhat thay vi moi tin nhan 1 request rieng. Voi cong dong dong
// nguoi (vd 80 thanh vien chat cung luc), day la cach tang suc chiu tai thuc su thay vi
// chi tang RPM_LIMIT - so luong request/phut khong doi nhung moi request xu ly duoc nhieu
// tin nhan hon. Cac tin nhan trong 1 batch hoan toan doc lap, khong lien quan ngu canh.
const BATCH_WINDOW_MS = 300;
const MAX_BATCH_SIZE = 20;

let pendingBatch = [];
let batchTimer = null;

function buildBatchSystemPrompt(languages) {
  const list = languages.map((lang) => `${lang.code} (${lang.name})`).join(", ");
  return [
    "Bạn là công cụ dịch thuật cho một hệ thống cầu nối chat đa kênh trên Discord, xử lý NHIỀU tin nhắn độc lập trong cùng 1 lượt.",
    `Đầu vào là một mảng JSON các tin nhắn, mỗi tin nhắn có "id" và "sourceLanguage" (ngôn ngữ nguồn CỐ ĐỊNH theo kênh gốc, bất kể nội dung thực tế trông giống ngôn ngữ nào) và "text".`,
    `Với MỖI tin nhắn, dịch "text" sang TẤT CẢ các ngôn ngữ sau, PHẢI điền đủ từng ngôn ngữ, không bỏ sót: ${list}.`,
    "Các tin nhắn hoàn toàn độc lập với nhau — tuyệt đối không trộn lẫn ngữ cảnh hay nội dung giữa các tin nhắn khác nhau khi dịch.",
    "Ưu tiên chính xác ngữ cảnh và thuật ngữ hơn là dịch từng từ theo nghĩa đen; giữ đúng giọng văn, sắc thái của từng bản gốc.",
    TRANSLATION_QUALITY_GUIDE,
    "Các chuỗi dạng ⟦P0⟧, ⟦P1⟧... là placeholder — giữ nguyên y hệt, không dịch, không đổi thứ tự hay khoảng trắng quanh chúng.",
    "Trả về đúng theo JSON schema đã cho: một mảng kết quả, mỗi phần tử gồm đúng \"id\" tương ứng và \"translations\". Không thêm giải thích, không thêm markdown.",
  ].join("\n");
}

function buildBatchSchema(languages) {
  const properties = {};
  for (const lang of languages) {
    properties[lang.code] = { type: "STRING", description: `Bản dịch sang ${lang.name} (${lang.code})` };
  }
  return {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        id: { type: "INTEGER", description: "Trùng khớp với id của tin nhắn đầu vào" },
        translations: { type: "OBJECT", properties, required: languages.map((lang) => lang.code) },
      },
      required: ["id", "translations"],
    },
  };
}

let nextBatchId = 1;

function scheduleFlush() {
  if (batchTimer) return;
  batchTimer = setTimeout(flushBatch, BATCH_WINDOW_MS);
}

async function flushBatch() {
  const batch = pendingBatch;
  pendingBatch = [];
  batchTimer = null;
  if (batch.length === 0) return;

  const { languages, apiKey } = batch[0];

  const body = {
    system_instruction: { parts: [{ text: buildBatchSystemPrompt(languages) }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify(
              batch.map((item) => ({ id: item.id, sourceLanguage: item.sourceLangName, text: item.cleanText }))
            ),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: buildBatchSchema(languages),
    },
  };

  try {
    const raw = await rateLimiter.schedule(() => callGeminiRaw(body, apiKey));
    const parsed = extractJson(raw);
    const byId = new Map(parsed.map((entry) => [entry.id, entry.translations]));

    for (const item of batch) {
      const translations = byId.get(item.id);
      if (translations) {
        translationCache.set(item.cacheKey, translations);
        item.resolve(translations);
      } else {
        item.reject(new Error("Gemini không trả về kết quả cho tin nhắn này trong batch."));
      }
    }
  } catch (error) {
    for (const item of batch) item.reject(error);
  }
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
 *
 * De chiu duoc tai cao (nhieu nguoi chat cung luc), cac loi goi gan nhau (trong vong
 * BATCH_WINDOW_MS) duoc GOP LAI thanh 1 request Gemini duy nhat thay vi moi tin nhan
 * 1 request rieng - tang suc chiu tai ma khong can tang RPM_LIMIT.
 * @returns {Promise<Record<string, string>>}
 */
function translateForRelay(cleanText, sourceLangName, languages, apiKey) {
  const cacheKey = `relay:${sourceLangName}::${languages.map((l) => l.code).sort().join(",")}::${cleanText}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    pendingBatch.push({
      id: nextBatchId++,
      sourceLangName,
      cleanText,
      languages,
      apiKey,
      cacheKey,
      resolve,
      reject,
    });

    if (pendingBatch.length >= MAX_BATCH_SIZE) {
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      flushBatch();
    } else {
      scheduleFlush();
    }
  });
}

function getCacheStats() {
  return { translationCacheSize: translationCache.size };
}

module.exports = { translateMessage, translateForRelay, getCacheStats };
