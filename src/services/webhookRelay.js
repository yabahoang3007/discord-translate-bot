// Lay hoac tao webhook cua bot trong 1 kenh, dung de gui tin nhan "gia lam" thanh vien
// (dung ten + avatar that) khi dong bo tin nhan dich sang cac kenh khac.
// Cache trong bo nho theo tien trinh - khong ghi file, vi webhook la 1 object song
// (khong co van de "doc du lieu cu" nhu cac file JSON config khac).
const WEBHOOK_NAME = "Cầu Nối Ngôn Ngữ";

const webhookCache = new Map();

async function getOrCreateWebhook(channel, client) {
  const cached = webhookCache.get(channel.id);
  if (cached) return cached;

  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find((w) => w.owner?.id === client.user.id && w.name === WEBHOOK_NAME);

  if (!webhook) {
    webhook = await channel.createWebhook({ name: WEBHOOK_NAME });
  }

  webhookCache.set(channel.id, webhook);
  return webhook;
}

module.exports = { getOrCreateWebhook };
