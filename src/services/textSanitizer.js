// Tach cac phan khong nen dich (code block, inline code, URL, mention, emoji custom)
// ra khoi noi dung truoc khi goi Gemini, roi ghep lai sau khi dich.
// Muc dich: giu dung cu phap Discord va tranh dich sai nhung thu khong phai ngon ngu tu nhien.

const PATTERNS = [
  /```[\s\S]*?```/g, // code block
  /`[^`\n]+`/g, // inline code
  /https?:\/\/\S+/g, // URL
  /<a?:\w+:\d+>/g, // custom/animated emoji
  /<@!?\d+>/g, // user mention
  /<@&\d+>/g, // role mention
  /<#\d+>/g, // channel mention
];

const LETTER_REGEX = /\p{L}/u;

function extractTranslatable(content) {
  const placeholders = [];
  let cleanText = content;

  for (const pattern of PATTERNS) {
    cleanText = cleanText.replace(pattern, (match) => {
      const token = `⟦P${placeholders.length}⟧`; // ⟦P0⟧ - ky tu hiem, Gemini se giu nguyen theo huong dan trong system prompt
      placeholders.push(match);
      return token;
    });
  }

  return { cleanText: cleanText.trim(), placeholders };
}

function restorePlaceholders(translatedText, placeholders) {
  let result = translatedText;
  placeholders.forEach((original, index) => {
    const token = `⟦P${index}⟧`;
    result = result.split(token).join(original);
  });
  return result;
}

function isTranslatable(cleanText, minLength = 2) {
  if (!cleanText || cleanText.length < minLength) return false;
  return LETTER_REGEX.test(cleanText);
}

module.exports = { extractTranslatable, restorePlaceholders, isTranslatable };
