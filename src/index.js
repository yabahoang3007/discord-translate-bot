require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Options } = require("discord.js");
const logger = require("./logger");
const { handleMessageCreate } = require("./handlers/messageCreate");
const { handleInteractionCreate } = require("./handlers/interactionCreate");
const { handleReactionAdd } = require("./handlers/reactionRelay");
const { startHealthServer } = require("./healthServer");
const { AUTO_COMMIT_ENABLED } = require("./services/dataBackup");

const { DISCORD_TOKEN, GEMINI_API_KEY } = process.env;

if (!DISCORD_TOKEN) {
  logger.error("Thiếu DISCORD_TOKEN trong .env");
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  logger.warn("Thiếu GEMINI_API_KEY — tính năng tự động dịch sẽ không hoạt động.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
  // Host chi co ~128MB RAM: gioi han cache cua discord.js. Code luon fetch lai tin nhan
  // khi can (relay, reaction, member list) nen khong phu thuoc vao cache tin nhan.
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 25,
    GuildMemberManager: { maxSize: 100, keepOverLimit: (member) => member.id === member.client.user.id },
    UserManager: { maxSize: 100, keepOverLimit: (user) => user.id === user.client.user.id },
    PresenceManager: 0,
    ReactionManager: 0,
    ReactionUserManager: 0,
    GuildEmojiManager: 0,
    GuildStickerManager: 0,
    VoiceStateManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 600, lifetime: 1800 },
  },
});

client.once("ready", () => {
  logger.info(`Đăng nhập thành công với tên ${client.user.tag}`);
  logger.info(
    AUTO_COMMIT_ENABLED
      ? "Tự động sao lưu data/*.json lên Git: BẬT"
      : "Tự động sao lưu data/*.json lên Git: TẮT (đặt AUTO_COMMIT_DATA=true để bật)"
  );
});

client.on("messageCreate", handleMessageCreate);
client.on("interactionCreate", handleInteractionCreate);
client.on("messageReactionAdd", handleReactionAdd);

client.on("error", (error) => logger.error("Lỗi Discord client:", error));

process.on("unhandledRejection", (reason) => logger.error("Unhandled rejection:", reason));
process.on("SIGINT", () => {
  logger.info("Đang tắt bot...");
  client.destroy();
  process.exit(0);
});
process.on("SIGTERM", () => {
  logger.info("Đang tắt bot...");
  client.destroy();
  process.exit(0);
});

client.login(DISCORD_TOKEN);
startHealthServer();
