const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const configStore = require("../config/store");
const channelLanguages = require("../config/channelLanguages");
const { describeLanguage, channelSlugFor } = require("../services/languageCatalog");
const { confirmDestructiveAction } = require("../services/confirmAction");

const data = new SlashCommandBuilder()
  .setName("language-channels")
  .setDescription("Thiết lập hệ thống kênh riêng theo ngôn ngữ, đồng bộ tin nhắn dịch giữa các kênh")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub.setName("setup").setDescription("Tạo/ánh xạ kênh cho từng ngôn ngữ đang cấu hình (#general = tiếng Anh)")
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("Xem ánh xạ kênh ↔ ngôn ngữ hiện tại"))
  .addSubcommand((sub) => sub.setName("reset").setDescription("Xóa ánh xạ (không xóa kênh đã tạo)"));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const mappings = channelLanguages.getMappings();
    if (mappings.length === 0) {
      await interaction.reply({ content: "Chưa thiết lập kênh theo ngôn ngữ nào.", ephemeral: true });
      return;
    }
    const text = mappings
      .map((m) => {
        const info = describeLanguage(m.code);
        return `${info.flag} ${info.name} → <#${m.channelId}>`;
      })
      .join("\n");
    await interaction.reply({ content: text, ephemeral: true });
    return;
  }

  if (subcommand === "reset") {
    const confirmed = await confirmDestructiveAction(interaction, {
      prompt:
        "Bạn sắp xóa **toàn bộ** ánh xạ kênh ↔ ngôn ngữ. Các kênh Discord vẫn còn, nhưng bot sẽ ngừng đồng bộ tin nhắn giữa chúng.",
    });
    if (!confirmed) return;

    channelLanguages.reset();
    await interaction.editReply({
      content: "Đã xóa ánh xạ kênh-ngôn ngữ. Các kênh vẫn còn nguyên, chỉ là bot không còn đồng bộ tin nhắn giữa chúng nữa.",
      components: [],
    });
    return;
  }

  if (subcommand === "setup") {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const languages = configStore.getLanguages();

    const generalChannel = guild.channels.cache.find(
      (c) => c.name === "general" && c.type === ChannelType.GuildText
    );
    if (!generalChannel) {
      await interaction.editReply("Không tìm thấy kênh #general trong server — cần có kênh này để làm kênh tiếng Anh.");
      return;
    }

    const summary = [];

    for (const lang of languages) {
      if (lang.code === "en") {
        channelLanguages.setMapping(generalChannel.id, "en");
        summary.push(`${lang.flag} ${lang.name} → #${generalChannel.name} (đã có sẵn)`);
        continue;
      }

      const channelName = `chat-${channelSlugFor(lang.code)}`;
      let channel = guild.channels.cache.find((c) => c.name === channelName && c.type === ChannelType.GuildText);

      if (!channel) {
        try {
          channel = await guild.channels.create({ name: channelName, type: ChannelType.GuildText });
        } catch (error) {
          summary.push(`${lang.flag} ${lang.name} → LỖI khi tạo kênh #${channelName}: ${error.message}`);
          continue;
        }
      }

      channelLanguages.setMapping(channel.id, lang.code);
      summary.push(`${lang.flag} ${lang.name} → #${channel.name}`);
    }

    await interaction.editReply(`Đã thiết lập xong:\n${summary.join("\n")}`);
  }
}

module.exports = { data, execute };
