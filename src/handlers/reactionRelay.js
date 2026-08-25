const logger = require("../logger");
const relayLinks = require("../services/relayLinks");

function emojiKeyOf(emoji) {
  return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

async function handleReactionAdd(reaction, user) {
  try {
    if (user.bot) return; // tranh vong lap khi chinh bot tu react lai cac ban sao

    if (reaction.partial) {
      reaction = await reaction.fetch().catch(() => null);
      if (!reaction) return;
    }

    const message = reaction.message;
    if (!message.guild) return;

    const group = relayLinks.getGroup(message.id);
    if (!group) return;

    const targetKey = emojiKeyOf(reaction.emoji);

    for (const entry of group) {
      if (entry.messageId === message.id) continue;

      try {
        const channel = await message.client.channels.fetch(entry.channelId);
        const targetMessage = await channel.messages.fetch(entry.messageId);
        const alreadyReacted = targetMessage.reactions.cache.some((r) => emojiKeyOf(r.emoji) === targetKey);
        if (!alreadyReacted) {
          await targetMessage.react(reaction.emoji);
        }
      } catch (error) {
        logger.error(`Không đồng bộ được reaction sang tin nhắn ${entry.messageId}:`, error.message);
      }
    }
  } catch (error) {
    logger.error("Lỗi khi xử lý messageReactionAdd:", error);
  }
}

module.exports = { handleReactionAdd };
