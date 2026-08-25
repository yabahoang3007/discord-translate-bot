const { Jimp } = require("jimp");

const MAX_DIMENSION = 320;
const MAX_BYTES = 512 * 1024;
const MIN_DIMENSION = 64;

// Discord yeu cau sticker tinh la PNG, toi da 320x320, toi da 512KB.
// Cover ve dung 320x320 truoc, neu van qua nang thi giam dan kich thuoc.
async function prepareStickerImage(buffer) {
  let size = MAX_DIMENSION;

  while (size >= MIN_DIMENSION) {
    const image = await Jimp.read(buffer);
    image.cover({ w: size, h: size });
    const output = await image.getBuffer("image/png");
    if (output.length <= MAX_BYTES) return output;
    size = Math.floor(size * 0.8);
  }

  throw new Error("Không thể nén ảnh xuống dưới 512KB dù đã giảm kích thước.");
}

module.exports = { prepareStickerImage };
