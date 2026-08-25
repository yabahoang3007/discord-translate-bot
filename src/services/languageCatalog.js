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

module.exports = { CATALOG, describeLanguage, normalizeCode };
