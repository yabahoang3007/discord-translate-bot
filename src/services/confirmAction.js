const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

// Hoi nguoi dung xac nhan truoc khi thuc hien bat ky hanh dong nao lam MAT du lieu
// (vd: cac lenh /... reset). Khong co gi bi xoa neu nguoi dung khong bam dung nut
// "Xac nhan xoa" trong thoi gian cho.
const CONFIRM_ID = "confirm-destructive";
const CANCEL_ID = "cancel-destructive";
const TIMEOUT_MS = 30_000;

/**
 * Gui 1 tin nhan ephemeral kem 2 nut xac nhan / huy va cho nguoi dung chon.
 * Tra ve true CHI KHI nguoi dung bam "Xac nhan xoa" truoc khi het gio.
 * Khi ham tra ve, interaction da duoc reply -> caller dung interaction.editReply()
 * de bao ket qua cuoi cung.
 *
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {{ prompt: string }} options prompt: mo ta ro rang cai gi sap bi xoa
 * @returns {Promise<boolean>}
 */
async function confirmDestructiveAction(interaction, { prompt }) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CONFIRM_ID).setLabel("Xác nhận xóa").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(CANCEL_ID).setLabel("Huỷ").setStyle(ButtonStyle.Secondary)
  );

  const message = await interaction.reply({
    content: `⚠️ ${prompt}\n\nHành động này **không thể hoàn tác**. Bấm **Xác nhận xóa** để tiếp tục.`,
    components: [row],
    ephemeral: true,
    fetchReply: true,
  });

  let choice;
  try {
    choice = await message.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: TIMEOUT_MS,
    });
  } catch {
    await interaction.editReply({ content: "⏱️ Hết thời gian chờ — không có gì bị xóa.", components: [] });
    return false;
  }

  if (choice.customId === CANCEL_ID) {
    await choice.update({ content: "Đã huỷ — không có gì bị xóa.", components: [] });
    return false;
  }

  await choice.update({ content: "Đang xử lý...", components: [] });
  return true;
}

module.exports = { confirmDestructiveAction };
