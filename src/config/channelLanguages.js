const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "..", "data", "channelLanguages.json");
const DEFAULTS = { channels: [] }; // [{ channelId, code }]

function load() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULTS, null, 2), "utf8");
  }
  return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
}

function save(next) {
  const tmpPath = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmpPath, FILE_PATH);
}

function getMappings() {
  return load().channels;
}

function setMapping(channelId, code) {
  const config = load();
  const existing = config.channels.find((c) => c.channelId === channelId);
  if (existing) existing.code = code;
  else config.channels.push({ channelId, code });
  save(config);
}

function reset() {
  save(DEFAULTS);
}

module.exports = { getMappings, setMapping, reset };
