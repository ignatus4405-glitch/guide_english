#!/usr/bin/env node
/**
 * Генерирует resources/icon.png и resources/icon.ico без внешних зависимостей.
 * Дизайн: скруглённый квадрат с градиентом (индиго → циан) и белой буквой «A».
 * Запуск: node scripts/make-icon.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- Geometry helpers ----------
function insideRoundedRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const cx = Math.min(Math.max(x, r), w - r);
  const cy = Math.min(Math.max(y, r), h - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 ? (wx * vx + wy * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Draw at high resolution then box-downscale for antialiasing
function renderIcon(size) {
  const S = size * 4; // supersample
  const buf = Buffer.alloc(S * S * 4, 0);

  const radius = S * 0.22;
  const c1 = [79, 70, 229];    // indigo
  const c2 = [6, 182, 212];    // cyan
  const c3 = [139, 92, 246];   // violet

  // «A» geometry
  const apexX = S * 0.5, apexY = S * 0.235;
  const leftX = S * 0.275, rightX = S * 0.725, baseY = S * 0.775;
  const stroke = S * 0.088;
  const barTop = S * 0.585, barBottom = S * 0.665;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      // rounded square
      if (!insideRoundedRect(x, y, S, S, radius)) continue;

      // diagonal gradient + subtle radial light
      const t = (x / S) * 0.55 + (y / S) * 0.45;
      let base;
      if (t < 0.55) {
        const k = t / 0.55;
        base = [lerp(c1[0], c3[0], k), lerp(c1[1], c3[1], k), lerp(c1[2], c3[2], k)];
      } else {
        const k = (t - 0.55) / 0.45;
        base = [lerp(c3[0], c2[0], k), lerp(c3[1], c2[1], k), lerp(c3[2], c2[2], k)];
      }

      // soft highlight top-left
      const hx = x / S - 0.22, hy = y / S - 0.18;
      const hl = Math.max(0, 1 - Math.sqrt(hx * hx + hy * hy) / 0.75) * 26;

      // letter A
      const dLeft = distToSegment(x, y, apexX, apexY, leftX, baseY);
      const dRight = distToSegment(x, y, apexX, apexY, rightX, baseY);
      const inLegs = Math.min(dLeft, dRight) <= stroke / 2;
      // crossbar between inner edges
      const crossT = (barTop - apexY) / (baseY - apexY);
      const innerLeft = lerp(apexX, leftX, crossT) + stroke / 2;
      const innerRight = lerp(apexX, rightX, crossT) - stroke / 2;
      const inBar = y >= barTop && y <= barBottom && x >= innerLeft && x <= innerRight;

      if (inLegs || inBar) {
        buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255;
      } else {
        buf[i] = Math.min(255, base[0] + hl);
        buf[i + 1] = Math.min(255, base[1] + hl);
        buf[i + 2] = Math.min(255, base[2] + hl);
        buf[i + 3] = 255;
      }
    }
  }

  // box downscale S -> size
  const out = Buffer.alloc(size * size * 4);
  const factor = S / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = 0; sy < factor; sy++) {
        for (let sx = 0; sx < factor; sx++) {
          const px = Math.floor(x * factor + sx);
          const py = Math.floor(y * factor + sy);
          const i = (py * S + px) * 4;
          const alpha = buf[i + 3] / 255;
          r += buf[i] * alpha; g += buf[i + 1] * alpha; b += buf[i + 2] * alpha; a += buf[i + 3];
          n++;
        }
      }
      const o = (y * size + x) * 4;
      const aAvg = a / n;
      if (aAvg > 0) {
        const wsum = (a / 255) || 1;
        out[o] = Math.round(r / wsum);
        out[o + 1] = Math.round(g / wsum);
        out[o + 2] = Math.round(b / wsum);
      }
      out[o + 3] = Math.round(aAvg);
    }
  }
  return out;
}

// ---------- ICO writer (PNG-compressed entries) ----------
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);          // reserved
  header.writeUInt16LE(1, 2);          // type = icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((e, idx) => {
    const b = idx * 16;
    dir[b] = e.size >= 256 ? 0 : e.size;
    dir[b + 1] = e.size >= 256 ? 0 : e.size;
    dir[b + 2] = 0;   // palette
    dir[b + 3] = 0;   // reserved
    dir.writeUInt16LE(1, b + 4);   // planes
    dir.writeUInt16LE(32, b + 6);  // bits per pixel
    dir.writeUInt32LE(e.png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += e.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map(e => e.png)]);
}

// ---------- Main ----------
function main() {
  const outDir = path.join(__dirname, '..', 'resources');
  fs.mkdirSync(outDir, { recursive: true });

  const sizes = [256, 128, 64, 48, 32, 16];
  const cache = new Map();
  const entries = sizes.map(size => {
    const rgba = renderIcon(size);
    const png = encodePng(size, size, rgba);
    cache.set(size, { rgba, png });
    return { size, png };
  });

  fs.writeFileSync(path.join(outDir, 'icon.ico'), buildIco(entries));
  fs.writeFileSync(path.join(outDir, 'icon.png'), cache.get(256).png);

  // simple 32x32 favicon for renderer
  fs.mkdirSync(path.join(__dirname, '..', 'src', 'renderer'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'renderer', 'favicon.png'), cache.get(32).png);

  console.log('✓ resources/icon.ico');
  console.log('✓ resources/icon.png');
  console.log('✓ src/renderer/favicon.png');
}

main();
