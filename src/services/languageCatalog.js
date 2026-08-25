// Bang tra cuu ma ngon ngu (ISO 639-1 / BCP-47 pho bien) -> ten hien thi + co.
// Chi can du cac ngon ngu thuong gap trong cong dong quoc te; ma khong co trong bang
// van duoc chap nhan (Gemini se tu xu ly), chi la khong co ten/co dep.
const CATALOG = {
  vi: { name: "Tiếng Việt", flag: "🇻🇳" },
  en: { name: "English", flag: "🇬🇧" },
  ja: { name: "日本語", flag: "🇯🇵" },
  ko: { name: "한국어", flag: "🇰🇷" },
  "zh-CN": { name: "中文（简体）", flag: "🇨🇳" },
  "zh-TW": { name: "中文（繁體）", flag: "🇹🇼" },
  fr: { name: "Français", flag: "🇫🇷" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  es: { name: "Español", flag: "🇪🇸" },
  pt: { name: "Português", flag: "🇵🇹" },
  "pt-BR": { name: "Português (Brasil)", flag: "🇧🇷" },
  ru: { name: "Русский", flag: "🇷🇺" },
  ar: { name: "العربية", flag: "🇸🇦" },
  hi: { name: "हिन्दी", flag: "🇮🇳" },
  ta: { name: "தமிழ்", flag: "🇮🇳" },
  th: { name: "ภาษาไทย", flag: "🇹🇭" },
  id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
  ms: { name: "Bahasa Melayu", flag: "🇲🇾" },
  tl: { name: "Filipino", flag: "🇵🇭" },
  it: { name: "Italiano", flag: "🇮🇹" },
  nl: { name: "Nederlands", flag: "🇳🇱" },
  pl: { name: "Polski", flag: "🇵🇱" },
  tr: { name: "Türkçe", flag: "🇹🇷" },
  uk: { name: "Українська", flag: "🇺🇦" },
  sv: { name: "Svenska", flag: "🇸🇪" },
  fi: { name: "Suomi", flag: "🇫🇮" },
  no: { name: "Norsk", flag: "🇳🇴" },
  da: { name: "Dansk", flag: "🇩🇰" },
  cs: { name: "Čeština", flag: "🇨🇿" },
  el: { name: "Ελληνικά", flag: "🇬🇷" },
  he: { name: "עברית", flag: "🇮🇱" },
  bn: { name: "বাংলা", flag: "🇧🇩" },
  ur: { name: "اردو", flag: "🇵🇰" },
  fa: { name: "فارسی", flag: "🇮🇷" },
  sw: { name: "Kiswahili", flag: "🇰🇪" },
};

function describeLanguage(code) {
  if (!code) return { code: "unknown", name: "Không xác định", flag: "🏳️" };
  const normalized = CATALOG[code] ? code : normalizeCode(code);
  const entry = CATALOG[normalized];
  return { code: normalized, name: entry ? entry.name : normalized, flag: entry ? entry.flag : "🏳️" };
}

// Google tra ve "zh-CN" hoac chi "zh"; ho tro ca doi truong hop khac hoa/thuong.
function normalizeCode(code) {
  const exact = Object.keys(CATALOG).find((c) => c.toLowerCase() === code.toLowerCase());
  return exact || code;
}

// Ten day du (khong viet tat) dung de dat ten kenh Discord, vd "chat-vietnamese".
const CHANNEL_SLUGS = {
  vi: "vietnamese",
  en: "english",
  ja: "japanese",
  ko: "korean",
  "zh-CN": "chinese",
  "zh-TW": "chinese-traditional",
  fr: "french",
  de: "german",
  es: "spanish",
  pt: "portuguese",
  "pt-BR": "portuguese-brazil",
  ru: "russian",
  ar: "arabic",
  hi: "hindi",
  ta: "tamil",
  th: "thai",
  id: "indonesian",
  ms: "malay",
  tl: "filipino",
  it: "italian",
  nl: "dutch",
  pl: "polish",
  tr: "turkish",
  uk: "ukrainian",
  sv: "swedish",
  fi: "finnish",
  no: "norwegian",
  da: "danish",
  cs: "czech",
  el: "greek",
  he: "hebrew",
  bn: "bengali",
  ur: "urdu",
  fa: "persian",
  sw: "swahili",
};

function channelSlugFor(code) {
  const normalized = normalizeCode(code);
  return CHANNEL_SLUGS[normalized] || normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Nhan dau vao tu thanh vien (co the la ma "fr" hoac ten "French"/"Français") va suy ra
// { code, name, flag }. Neu khong co trong CATALOG, tu tao 1 ma slug tu chinh ten do —
// Gemini van dich duoc binh thuong voi ten ngon ngu bat ky, khong bat buoc phai co san trong bang.
function resolveLanguageInput(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  const codeMatch = Object.keys(CATALOG).find((c) => c.toLowerCase() === lower);
  if (codeMatch) return { code: codeMatch, name: CATALOG[codeMatch].name, flag: CATALOG[codeMatch].flag };

  // Ten ban ngu (vd "Français", "Deutsch")
  const nativeNameMatch = Object.entries(CATALOG).find(([, info]) => info.name.toLowerCase() === lower);
  if (nativeNameMatch) return { code: nativeNameMatch[0], name: nativeNameMatch[1].name, flag: nativeNameMatch[1].flag };

  // Ten tieng Anh thong dung (vd "French") - so voi CHANNEL_SLUGS vi day chinh la ten tieng Anh dang slug hoa
  const normalizedInput = lower.replace(/[^a-z0-9]+/g, "");
  const englishNameMatch = Object.entries(CHANNEL_SLUGS).find(
    ([, slug]) => slug.replace(/-/g, "") === normalizedInput
  );
  if (englishNameMatch) {
    const [code] = englishNameMatch;
    const info = CATALOG[code];
    return { code, name: info ? info.name : code, flag: info ? info.flag : "🏳️" };
  }

  const slug = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return null;
  return { code: slug, name: trimmed, flag: "🏳️" };
}

module.exports = { CATALOG, describeLanguage, normalizeCode, channelSlugFor, resolveLanguageInput };
