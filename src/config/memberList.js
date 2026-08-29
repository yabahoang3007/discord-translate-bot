const fs = require("fs");
const path = require("path");
const { scheduleBackup } = require("../services/dataBackup");

const FILE_PATH = path.join(__dirname, "..", "..", "data", "memberList.json");

const DEFAULTS = { channelId: null, messageIds: {}, entries: [] };

function load() {
  if (!fs.existsSync(FILE_PATH)) {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULTS, null, 2), "utf8");
  }

  const config = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  if (!config.messageIds) config.messageIds = {}; // tuong thich nguoc voi file cu chi co 1 messageId
  return config;
}

function save(next) {
  const tmpPath = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmpPath, FILE_PATH);
  scheduleBackup();
}

function getConfig() {
  return load();
}

function setChannel(channelId) {
  const config = load();
  config.channelId = channelId;
  save(config);
}

function getMessageIdForChannel(channelId) {
  return load().messageIds[channelId] || null;
}

function setMessageIdForChannel(channelId, messageId) {
  const config = load();
  config.messageIds[channelId] = messageId;
  save(config);
}

// Ghi de: neu userId da co trong danh sach, cap nhat ten tai vi tri cu.
function upsertEntry(userId, name) {
  const config = load();
  const existing = config.entries.find((e) => e.userId === userId);
  if (existing) {
    existing.name = name;
    existing.updatedAt = new Date().toISOString();
  } else {
    config.entries.push({ userId, name, updatedAt: new Date().toISOString() });
  }
  save(config);
  return config.entries;
}

function reset() {
  const config = load();
  config.entries = [];
  config.messageIds = {};
  save(config);
}

module.exports = {
  getConfig,
  setChannel,
  getMessageIdForChannel,
  setMessageIdForChannel,
  upsertEntry,
  reset,
};
