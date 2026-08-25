require("dotenv").config();
const { REST, Routes } = require("discord.js");
const logger = require("./logger");
const { commands } = require("./commands");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  logger.error("Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong .env");
  process.exit(1);
}

const body = commands.map((command) => command.data.toJSON());
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function main() {
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  logger.info(GUILD_ID ? `Đăng ký ${body.length} lệnh cho guild ${GUILD_ID}...` : `Đăng ký ${body.length} lệnh toàn cục...`);
  await rest.put(route, { body });
  logger.info("Đăng ký slash command thành công.");
}

main().catch((error) => {
  logger.error("Đăng ký slash command thất bại:", error);
  process.exit(1);
});
