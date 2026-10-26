// Genera los iconos PWA de Zero Delivery sin dependencias externas (PNG encoder con zlib).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixelAt) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      const i = (y * size + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Diseno "Z" en grilla 12x12: fondo azul, Z blanca, punto naranja.
const BLUE = [0x25, 0x63, 0xeb, 255];
const WHITE = [0xff, 0xff, 0xff, 255];
const ORANGE = [0xea, 0x58, 0x0c, 255];
const TRANSPARENT = [0, 0, 0, 0];

function designCell(gx, gy) {
  const topBar = gy === 2 && gx >= 3 && gx <= 8;
  const bottomBar = gy === 9 && gx >= 3 && gx <= 8;
  const diagonal = gx + gy === 11 && gy >= 3 && gy <= 8;
  if (topBar || bottomBar || diagonal) return WHITE;
  if ((gx === 9 || gx === 10) && (gy === 5 || gy === 6)) return ORANGE;
  return BLUE;
}

function makeIcon(size, { maskable = false, rounded = false } = {}) {
  const margin = maskable ? size * 0.1 : 0;
  const inner = size - margin * 2;
  const cell = inner / 12;
  const radius = rounded ? size * 0.18 : 0;

  return encodePng(size, (x, y) => {
    if (rounded) {
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      if (cx < radius && cy < radius) {
        const dx = radius - cx;
        const dy = radius - cy;
        if (dx * dx + dy * dy > radius * radius) return TRANSPARENT;
      }
    }
    if (x < margin || y < margin || x >= margin + inner || y >= margin + inner) {
      return maskable ? BLUE : (rounded ? BLUE : TRANSPARENT);
    }
    const gx = Math.floor((x - margin) / cell);
    const gy = Math.floor((y - margin) / cell);
    return designCell(Math.min(gx, 11), Math.min(gy, 11));
  });
}

const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { rounded: true }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(outDir, name), makeIcon(size, opts));
  console.log(`[icons] ${name} (${size}x${size}) generado`);
}
