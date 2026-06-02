/**
 * Generates 512x512 and 192x192 PWA icons as PNG files.
 * Uses pure Node.js (no external dependencies) via minimal PNG encoding.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

const BG = { r: 22, g: 163, b: 74 }; // #16a34a
const WHITE = { r: 255, g: 255, b: 255 };

function createIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.32;
  const letterScale = size / 512;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Green circle background
      if (dist <= outerR) {
        pixels[idx] = BG.r;
        pixels[idx + 1] = BG.g;
        pixels[idx + 2] = BG.b;
        pixels[idx + 3] = 255;

        // White ring
        if (dist >= innerR && dist <= innerR + 3 * letterScale) {
          pixels[idx] = WHITE.r;
          pixels[idx + 1] = WHITE.g;
          pixels[idx + 2] = WHITE.b;
        }

        // Pickleball holes (6 dots)
        const holes = [
          [0, -0.22], [0.19, -0.11], [0.19, 0.11],
          [0, 0.22], [-0.19, 0.11], [-0.19, -0.11],
        ];
        for (const [hx, hy] of holes) {
          const hdx = x - (cx + hx * outerR);
          const hdy = y - (cy + hy * outerR);
          if (hdx * hdx + hdy * hdy <= (5 * letterScale) ** 2) {
            pixels[idx] = WHITE.r;
            pixels[idx + 1] = WHITE.g;
            pixels[idx + 2] = WHITE.b;
          }
        }

        // Letter "P" in center
        if (isLetterP(x, y, cx, cy, letterScale)) {
          pixels[idx] = WHITE.r;
          pixels[idx + 1] = WHITE.g;
          pixels[idx + 2] = WHITE.b;
        }
      } else {
        pixels[idx + 3] = 0; // transparent outside circle
      }
    }
  }

  return encodePNG(size, size, pixels);
}

function isLetterP(x, y, cx, cy, s) {
  const lx = x - cx;
  const ly = y - cy + 8 * s;
  const t = 3 * s;
  const w = 50 * s;
  const h = 70 * s;
  const bowl = 35 * s;

  // Vertical stem
  if (lx >= -w / 2 && lx <= -w / 2 + t && ly >= -h / 2 && ly <= h / 2) return true;

  // Top horizontal
  if (ly >= -h / 2 && ly <= -h / 2 + t && lx >= -w / 2 && lx <= bowl) return true;

  // Middle horizontal
  if (ly >= -5 * s && ly <= -5 * s + t && lx >= -w / 2 && lx <= bowl) return true;

  // Bowl right side
  if (lx >= bowl - t && lx <= bowl && ly >= -h / 2 && ly <= -5 * s + t) return true;

  return false;
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(raw);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

writeFileSync(join(outDir, 'icon-512.png'), createIcon(512));
writeFileSync(join(outDir, 'icon-192.png'), createIcon(192));
console.log('Generated icon-192.png and icon-512.png in public/icons/');
