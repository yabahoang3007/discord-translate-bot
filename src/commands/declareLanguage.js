const { SlashCommandBuilder, ChannelType } = require("discord.js");
const configStore = require("../config/store");
const channelLanguages = require("../config/channelLanguages");
const { channelSlugFor, resolveLanguageInput } = require("../services/languageCatalog");

const data = new SlashCommandBuilder()
  .setName("declare-language")
  .setDescription("Yêu cầu bot tạo kênh chat riêng cho một ngôn ngữ mới, tự động đồng bộ với các kênh khác")
  .addStringOption((opt) =>
    opt
      .setName("language")
      .setDescription("Mã ngôn ngữ hoặc tên ngôn ngữ, ví dụ: fr hoặc French")
      .setRequired(true)
  );

async function execute(interaction) {
  const input = interaction.options.getString("language", true);
  const info = resolveLanguageInput(input);

  if (!info) {
    await interaction.reply({
      content: "Không nhận diện được ngôn ngữ này. Thử lại với mã ngôn ngữ (vd: fr) hoặc tên (vd: French).",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const guild = interaction.guild;
  const languages = configStore.getLanguages();
  const mappings = channelLanguages.getMappings();
  const existingMapping = mappings.find((m) => m.code === info.code);

  if (languages.some((l) => l.code === info.code) && existingMapping) {
    await interaction.editReply(`${info.flag} ${info.name} đã có kênh riêng rồi: <#${existingMapping.channelId}>`);
    return;
  }

  if (!languages.some((l) => l.code === info.code)) {
    configStore.setLanguages([...languages, { code: info.code, name: info.name, flag: info.flag }]);
  }

  let channel;

  if (info.code === "en") {
    channel = guild.channels.cache.find((c) => c.name === "general" && c.type === ChannelType.GuildText);
  }

  if (!channel) {
    const channelName = `chat-${channelSlugFor(info.code)}`;
    channel = guild.channels.cache.find((c) => c.name === channelName && c.type === ChannelType.GuildText);

    if (!channel) {
      try {
        channel = await guild.channels.create({ name: channelName, type: ChannelType.GuildText });
      } catch (error) {
        await interaction.editReply(`Không tạo được kênh (bot có thể thiếu quyền Manage Channels): ${error.message}`);
        return;
      }
    }
  }

  channelLanguages.setMapping(channel.id, info.code);

  await interaction.editReply(
    `Đã kích hoạt kênh ${info.flag} ${info.name}: <#${channel.id}> — tin nhắn ở đây sẽ tự động đồng bộ (dịch qua lại) với các kênh ngôn ngữ khác.`
  );
}

module.exports = { data, execute };
