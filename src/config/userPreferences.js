const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "..", "data", "userPreferences.json");

let cache = null;

function load() {
  if (cache) return cache;

  if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, "{}", "utf8");
  }

  cache = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  return cache;
}

function save(next) {
  cache = next;
  const tmpPath = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmpPath, FILE_PATH);
}

function getMutedLanguages(userId) {
  return load()[userId] || [];
}

// Tra ve true neu sau khi bam la TRANG THAI MOI = da mute.
function toggleMutedLanguage(userId, code) {
  const prefs = load();
  const current = prefs[userId] || [];
  const idx = current.indexOf(code);

  let updated;
  let nowMuted;
  if (idx >= 0) {
    updated = current.filter((c) => c !== code);
    nowMuted = false;
  } else {
    updated = [...current, code];
    nowMuted = true;
  }

  if (updated.length === 0) {
    delete prefs[userId];
  } else {
    prefs[userId] = updated;
  }
  save(prefs);
  return nowMuted;
}

module.exports = { getMutedLanguages, toggleMutedLanguage };
