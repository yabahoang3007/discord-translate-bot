const logger = require("../logger");
const { commands } = require("../commands");

const commandMap = new Map(commands.map((command) => [command.data.name, command]));

async function handleInteractionCreate(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Lỗi khi xử lý lệnh /${interaction.commandName}:`, error);
    const payload = { content: "Đã xảy ra lỗi khi thực hiện lệnh này.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

module.exports = { handleInteractionCreate };
