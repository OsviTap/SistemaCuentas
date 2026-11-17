/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 * Uso: npm run icons -w @mariel/web
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '../public');

const BACKGROUND = [11, 127, 77];
const FOREGROUND = [255, 255, 255];

/** Trazos normalizados de la letra M. */
const STROKES = [
  [0.3, 0.73, 0.3, 0.27],
  [0.7, 0.73, 0.7, 0.27],
  [0.31, 0.29, 0.5, 0.6],
  [0.69, 0.29, 0.5, 0.6]
];
const THICKNESS = 0.105;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA

  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function distanceToSegment(px, py, [ax, ay, bx, by]) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lengthSquared = vx * vx + vy * vy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const halfThickness = (THICKNESS / 2) * size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;

      let distance = Infinity;
      for (const stroke of STROKES) {
        distance = Math.min(distance, distanceToSegment(px, py, stroke));
      }

      const coverage = Math.max(0, Math.min(1, halfThickness - distance * size + 0.5));
      const offset = (y * size + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          BACKGROUND[channel] + (FOREGROUND[channel] - BACKGROUND[channel]) * coverage
        );
      }
      pixels[offset + 3] = 255;
    }
  }

  return encodePng(size, pixels);
}

mkdirSync(publicDir, { recursive: true });

const targets = [
  ['pwa-64x64.png', 64],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['maskable-icon-512x512.png', 512],
  ['apple-touch-icon-180x180.png', 180]
];

for (const [file, size] of targets) {
  writeFileSync(resolve(publicDir, file), render(size));
  console.log(`Generado ${file} (${size}×${size})`);
}
