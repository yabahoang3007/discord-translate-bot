const fs = require("fs");
const path = require("path");
const { scheduleBackup } = require("../services/dataBackup");

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
  scheduleBackup();
}

function getMappings() {
  return load().channels;
}

function setMapping(channelId, code) {
  const config = load();
  // 1 ngon ngu = dung 1 kenh: bo moi anh xa cu cua code nay (vd kenh bi xoa & tao lai,
  // channelId doi) va moi anh xa cu cua chinh kenh nay sang code khac, roi them lai 1 dong sach.
  config.channels = config.channels.filter((c) => c.channelId !== channelId && c.code !== code);
  config.channels.push({ channelId, code });
  save(config);
}

function reset() {
  save(DEFAULTS);
}

module.exports = { getMappings, setMapping, reset };
