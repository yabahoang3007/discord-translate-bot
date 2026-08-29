require("dotenv").config();
const { REST, Routes } = require("discord.js");
const logger = require("./logger");
const { commands } = require("./commands");

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  logger.error("Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong .env");
  process.exit(1);
}

// Ho tro ca GUILD_ID (1 id) lan GUILD_IDS (nhieu id, cach nhau dau phay). Dang ky theo guild
// cap nhat NGAY; dang ky toan cuc co the mat toi ~1 tieng moi hien lenh moi.
const guildIds = (process.env.GUILD_IDS || process.env.GUILD_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const body = commands.map((command) => command.data.toJSON());
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function main() {
  if (guildIds.length === 0) {
    logger.info(`Đăng ký ${body.length} lệnh toàn cục (có thể mất tới ~1 tiếng để hiển thị)...`);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
  } else {
    for (const guildId of guildIds) {
      logger.info(`Đăng ký ${body.length} lệnh cho guild ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
    }
  }
  logger.info("Đăng ký slash command thành công.");
}

main().catch((error) => {
  logger.error("Đăng ký slash command thất bại:", error);
  process.exit(1);
});
