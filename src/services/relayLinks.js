// Ghi nho 1 "nhom" cac tin nhan (tin nhan goc + cac ban dich duoc webhook dang o kenh khac)
// de dong bo reaction qua lai giua chung. Chi giu trong bo nho (khong ghi file) va co TTL,
// vi day la trang thai tam thoi phuc vu tuong tac gan thoi gian thuc, khong can luu vinh vien.
const TtlCache = require("./ttlCache");

const linkCache = new TtlCache(24 * 60 * 60 * 1000); // 24 gio

// entries: [{ channelId, messageId }, ...] - moi tin nhan trong nhom deu tro toi cung 1 mang nay
function registerGroup(entries) {
  for (const entry of entries) {
    linkCache.set(entry.messageId, entries);
  }
}

function getGroup(messageId) {
  return linkCache.get(messageId) || null;
}

module.exports = { registerGroup, getGroup };
