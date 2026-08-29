const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const configStore = require("../config/store");
const channelLanguages = require("../config/channelLanguages");
const { describeLanguage, channelSlugFor, resolveLanguageInput } = require("../services/languageCatalog");
const { confirmDestructiveAction } = require("../services/confirmAction");

const data = new SlashCommandBuilder()
  .setName("language-channels")
  .setDescription("Thiết lập hệ thống kênh riêng theo ngôn ngữ, đồng bộ tin nhắn dịch giữa các kênh")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub.setName("setup").setDescription("Tạo/ánh xạ kênh cho từng ngôn ngữ đang cấu hình (#general = tiếng Anh)")
  )
  .addSubcommand((sub) =>
    sub
      .setName("map")
      .setDescription("Gán kênh HIỆN TẠI cho 1 ngôn ngữ (dùng khi kênh bị tạo lại/đổi tên, ID không còn khớp)")
      .addStringOption((opt) =>
        opt.setName("language").setDescription("Mã hoặc tên ngôn ngữ, vd: en, vi, Korean").setRequired(true)
      )
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

  if (subcommand === "map") {
    const input = interaction.options.getString("language", true);
    const info = resolveLanguageInput(input);
    if (!info) {
      await interaction.reply({
        content: "Không nhận diện được ngôn ngữ. Thử mã (vd: `en`, `vi`) hoặc tên tiếng Anh (vd: `Korean`).",
        ephemeral: true,
      });
      return;
    }

    channelLanguages.setMapping(interaction.channelId, info.code);
    await interaction.reply({
      content: `Đã gán kênh này → ${info.flag} ${info.name} (${info.code}). Tin nhắn ở đây sẽ đồng bộ/dịch qua lại với các kênh ngôn ngữ khác.`,
      ephemeral: true,
    });
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

    // Kenh tieng Anh: uu tien #general (quy uoc cu), roi #chat-english, roi kenh dang duoc
    // map "en" san. Neu deu khong co -> bo qua "en" trong vong lap, nhac dung /language-channels map.
    const enMappedId = channelLanguages.getMappings().find((m) => m.code === "en")?.channelId;
    const englishChannel =
      guild.channels.cache.find((c) => c.name === "general" && c.type === ChannelType.GuildText) ||
      guild.channels.cache.find((c) => c.name === "chat-english" && c.type === ChannelType.GuildText) ||
      (enMappedId && guild.channels.cache.get(enMappedId));

    const summary = [];

    for (const lang of languages) {
      if (lang.code === "en") {
        if (englishChannel) {
          channelLanguages.setMapping(englishChannel.id, "en");
          summary.push(`${lang.flag} ${lang.name} → #${englishChannel.name} (đã có sẵn)`);
        } else {
          summary.push(
            `${lang.flag} ${lang.name} → BỎ QUA: không thấy #general hay #chat-english. Vào kênh tiếng Anh gõ \`/language-channels map language:en\`.`
          );
        }
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
