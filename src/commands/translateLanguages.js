const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const configStore = require("../config/store");
const { describeLanguage } = require("../services/languageCatalog");

const data = new SlashCommandBuilder()
  .setName("translate-languages")
  .setDescription("Quản lý danh sách ngôn ngữ mà bot sẽ tự động dịch qua lại")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Đặt danh sách ngôn ngữ của cộng đồng (thay thế danh sách cũ)")
      .addStringOption((opt) =>
        opt
          .setName("codes")
          .setDescription("Mã ngôn ngữ, cách nhau bởi dấu phẩy. Ví dụ: vi,en,ja,ko")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("Xem danh sách ngôn ngữ hiện tại"));

async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const languages = configStore.getLanguages();
    const text = languages.map((lang) => `${lang.flag} ${lang.name} (${lang.code})`).join("\n") || "Chưa cấu hình.";
    await interaction.reply({ content: `**Ngôn ngữ đang bật:**\n${text}`, ephemeral: true });
    return;
  }

  if (subcommand === "set") {
    const raw = interaction.options.getString("codes", true);
    const codes = [...new Set(raw.split(",").map((c) => c.trim()).filter(Boolean))];

    if (codes.length < 2) {
      await interaction.reply({ content: "Cần ít nhất 2 ngôn ngữ để bot có thể dịch qua lại.", ephemeral: true });
      return;
    }

    const languages = codes.map((code) => {
      const info = describeLanguage(code);
      return { code: info.code, name: info.name, flag: info.flag };
    });

    configStore.setLanguages(languages);
    const text = languages.map((lang) => `${lang.flag} ${lang.name} (${lang.code})`).join("\n");
    await interaction.reply({ content: `Đã cập nhật danh sách ngôn ngữ:\n${text}`, ephemeral: true });
  }
}

module.exports = { data, execute };
