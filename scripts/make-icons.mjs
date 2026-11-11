// Genera los íconos de la PWA (sin dependencias): node scripts/make-icons.mjs
// Fondo con degradé + tres barras redondeadas ascendentes, dentro de la zona
// segura de los íconos "maskable" (80%). iOS redondea las esquinas solo.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
// Degradé verde Apple (arriba) → verde azulado (abajo).
const TOP = [52, 211, 120];
const BOTTOM = [0, 150, 120];

// Barras en coordenadas normalizadas 0..1: [x0, y0, x1, y1]
const BARS = [
  [0.27, 0.56, 0.39, 0.72],
  [0.44, 0.44, 0.56, 0.72],
  [0.61, 0.30, 0.73, 0.72],
];
const RADIUS = 0.035;

function inRoundRect(x, y, [x0, y0, x1, y1], r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size) {
  const SS = 4;
  const buf = Buffer.alloc(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (BARS.some((b) => inRoundRect(x, y, b, RADIUS))) cover++;
        }
      const t = py / (size - 1);
      const a = cover / (SS * SS);
      const i = (py * size + px) * 3;
      for (let c = 0; c < 3; c++) {
        const bg = lerp(TOP[c], BOTTOM[c], t);
        buf[i + c] = Math.round(lerp(bg, 255, a));
      }
    }
  }
  return png(size, buf);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(`public/icons/${name}`, render(size));
  console.log('ok', name);
}
