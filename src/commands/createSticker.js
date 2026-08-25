const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prepareStickerImage } = require("../services/stickerImage");

const data = new SlashCommandBuilder()
  .setName("create-sticker")
  .setDescription("Tạo sticker chính thức cho server từ ảnh bạn gửi")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addAttachmentOption((opt) =>
    opt.setName("image").setDescription("Ảnh để làm sticker (PNG/JPG/WebP)").setRequired(true)
  )
  .addStringOption((opt) => opt.setName("name").setDescription("Tên sticker (2-30 ký tự)").setRequired(true))
  .addStringOption((opt) =>
    opt.setName("tags").setDescription("Từ khoá liên quan, vd: cười, vui (mặc định dùng luôn tên)").setRequired(false)
  );

async function execute(interaction) {
  const attachment = interaction.options.getAttachment("image", true);
  const name = interaction.options.getString("name", true).trim();
  const tags = interaction.options.getString("tags")?.trim() || name;

  if (!attachment.contentType || !attachment.contentType.startsWith("image/")) {
    await interaction.reply({ content: "File đính kèm phải là ảnh (PNG/JPG/WebP...).", ephemeral: true });
    return;
  }

  if (name.length < 2 || name.length > 30) {
    await interaction.reply({ content: "Tên sticker phải từ 2 đến 30 ký tự.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error(`Không tải được ảnh (HTTP ${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const stickerBuffer = await prepareStickerImage(buffer);

    const sticker = await interaction.guild.stickers.create({
      file: stickerBuffer,
      name,
      tags,
      description: `Tạo bởi ${interaction.user.username} qua /create-sticker`,
    });

    await interaction.editReply(`🎉 Đã tạo sticker **${sticker.name}** cho server!`);
  } catch (error) {
    await interaction.editReply(`Không tạo được sticker: ${error.message}`);
  }
}

module.exports = { data, execute };
