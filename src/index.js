require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const logger = require("./logger");
const { handleMessageCreate } = require("./handlers/messageCreate");
const { handleInteractionCreate } = require("./handlers/interactionCreate");
const { handleReactionAdd } = require("./handlers/reactionRelay");
const { startHealthServer } = require("./healthServer");

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
});

client.once("ready", () => {
  logger.info(`Đăng nhập thành công với tên ${client.user.tag}`);
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
