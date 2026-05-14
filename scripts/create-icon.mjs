import { writeFileSync } from "node:fs";
import { join } from "node:path";

const size = 32;
const pixels = Buffer.alloc(size * size * 4);

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const index = ((size - 1 - y) * size + x) * 4;
    const dx = x - size / 2;
    const dy = y - size / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const inside = distance < 14;
    const shine = Math.max(0, 1 - distance / 18);
    const r = inside ? Math.round(96 + shine * 110) : 18;
    const g = inside ? Math.round(38 + shine * 44) : 13;
    const b = inside ? Math.round(210 + shine * 35) : 30;
    const a = inside ? 255 : 0;

    pixels[index] = b;
    pixels[index + 1] = g;
    pixels[index + 2] = r;
    pixels[index + 3] = a;
  }
}

const bitmapHeaderSize = 40;
const xorSize = pixels.length;
const andMaskSize = size * 4;
const imageSize = bitmapHeaderSize + xorSize + andMaskSize;
const buffer = Buffer.alloc(6 + 16 + imageSize);
let offset = 0;

buffer.writeUInt16LE(0, offset);
offset += 2;
buffer.writeUInt16LE(1, offset);
offset += 2;
buffer.writeUInt16LE(1, offset);
offset += 2;

buffer.writeUInt8(size, offset);
offset += 1;
buffer.writeUInt8(size, offset);
offset += 1;
buffer.writeUInt8(0, offset);
offset += 1;
buffer.writeUInt8(0, offset);
offset += 1;
buffer.writeUInt16LE(1, offset);
offset += 2;
buffer.writeUInt16LE(32, offset);
offset += 2;
buffer.writeUInt32LE(imageSize, offset);
offset += 4;
buffer.writeUInt32LE(22, offset);
offset += 4;

buffer.writeUInt32LE(bitmapHeaderSize, offset);
offset += 4;
buffer.writeInt32LE(size, offset);
offset += 4;
buffer.writeInt32LE(size * 2, offset);
offset += 4;
buffer.writeUInt16LE(1, offset);
offset += 2;
buffer.writeUInt16LE(32, offset);
offset += 2;
buffer.writeUInt32LE(0, offset);
offset += 4;
buffer.writeUInt32LE(xorSize, offset);
offset += 4;
buffer.writeInt32LE(0, offset);
offset += 4;
buffer.writeInt32LE(0, offset);
offset += 4;
buffer.writeUInt32LE(0, offset);
offset += 4;
buffer.writeUInt32LE(0, offset);
offset += 4;

pixels.copy(buffer, offset);
offset += pixels.length;
Buffer.alloc(andMaskSize).copy(buffer, offset);

writeFileSync(join("src-tauri", "icons", "icon.ico"), buffer);
