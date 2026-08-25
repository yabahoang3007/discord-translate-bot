const fs = require("fs");
const path = require("path");
const logger = require("../logger");

const DEFAULT_CONFIG_PATH = path.join(__dirname, "..", "..", "config", "languages.default.json");
const LIVE_CONFIG_PATH = path.join(__dirname, "..", "..", "data", "config.json");

// Khong cache trong bo nho: luon doc thang tu file de tien trinh bot thay ngay
// thay doi du config bi sua boi mot process khac (vd: script chinh sua thu cong).
function load() {
  if (!fs.existsSync(LIVE_CONFIG_PATH)) {
    const defaults = fs.readFileSync(DEFAULT_CONFIG_PATH, "utf8");
    fs.mkdirSync(path.dirname(LIVE_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(LIVE_CONFIG_PATH, defaults, "utf8");
    logger.info("Đã tạo data/config.json từ cấu hình mặc định.");
  }

  return JSON.parse(fs.readFileSync(LIVE_CONFIG_PATH, "utf8"));
}

function save(next) {
  const tmpPath = `${LIVE_CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmpPath, LIVE_CONFIG_PATH);
}

function getConfig() {
  return load();
}

function getLanguages() {
  return load().languages;
}

function setLanguages(languages) {
  const config = load();
  config.languages = languages;
  save(config);
  return config;
}

function isChannelEnabled(channelId) {
  const { ignoredChannels, onlyChannels } = load();
  if (onlyChannels.length > 0) return onlyChannels.includes(channelId);
  return !ignoredChannels.includes(channelId);
}

function toggleIgnoredChannel(channelId) {
  const config = load();
  const idx = config.ignoredChannels.indexOf(channelId);
  if (idx >= 0) config.ignoredChannels.splice(idx, 1);
  else config.ignoredChannels.push(channelId);
  save(config);
  return config.ignoredChannels.includes(channelId);
}

function toggleOnlyChannel(channelId) {
  const config = load();
  const idx = config.onlyChannels.indexOf(channelId);
  if (idx >= 0) config.onlyChannels.splice(idx, 1);
  else config.onlyChannels.push(channelId);
  save(config);
  return config.onlyChannels.includes(channelId);
}

function resetChannelRules() {
  const config = load();
  config.ignoredChannels = [];
  config.onlyChannels = [];
  save(config);
}

module.exports = {
  getConfig,
  getLanguages,
  setLanguages,
  isChannelEnabled,
  toggleIgnoredChannel,
  toggleOnlyChannel,
  resetChannelRules,
};
