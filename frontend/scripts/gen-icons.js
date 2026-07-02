// scripts/gen-icons.js
// Dependency-free generator for the Remindus blue-bell icon.
// Renders the icon analytically (rounded squircle + tile + bell) with 4x4
// supersampled anti-aliasing and encodes PNGs using Node's built-in zlib.
'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Brand palette (matches src/assets/icon.svg) ──────────────────────────────
const BG   = [61, 90, 241];   // #3D5AF1
const TILE = [107, 142, 255]; // #5B7CFF with 10% white overlay, pre-blended
const WHITE = [255, 255, 255];
const S = 512; // design space

// ── Geometry helpers (all in 512-space) ──────────────────────────────────────
function insideRoundRect(x, y, x0, y0, w, h, r) {
  const x1 = x0 + w, y1 = y0 + h;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  // corner regions
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideBell(x, y) {
  // stem
  if (insideRoundRect(x, y, 246, 172, 20, 24, 10)) return true;
  const dx = x - 256;
  // dome (upper half-ellipse, shoulders at y=262)
  if (y >= 190 && y <= 262) {
    const ex = dx / 72, ey = (y - 262) / 72;
    if (ex * ex + ey * ey <= 1) return true;
  }
  // straight body sides
  if (y > 262 && y <= 300) return Math.abs(dx) <= 72;
  // flared rim
  if (y > 300 && y <= 330) {
    const halfw = 72 + ((y - 300) / 30) * (96 - 72);
    return Math.abs(dx) <= halfw;
  }
  // clapper (lower half-ellipse)
  if (y > 330 && y <= 366) {
    const ex = dx / 24, ey = (y - 330) / 36;
    return ex * ex + ey * ey <= 1;
  }
  return false;
}

// Sample colour+alpha at a point in 512-space. `round` clips to a circle.
function sample(x, y, round) {
  let inBg;
  if (round) {
    const dx = x - 256, dy = y - 256;
    inBg = dx * dx + dy * dy <= 256 * 256;
  } else {
    inBg = insideRoundRect(x, y, 0, 0, S, S, 112);
  }
  if (!inBg) return [0, 0, 0, 0];
  if (insideBell(x, y)) return [...WHITE, 255];
  if (insideRoundRect(x, y, 128, 128, 256, 256, 64)) return [...TILE, 255];
  return [...BG, 255];
}

// Splash: solid blue background with a centred icon mark (squircle + tile + bell).
// markFrac controls the mark size relative to the shorter screen edge.
function makeSplashSampler(W, H, markFrac) {
  const m = Math.min(W, H) * markFrac; // mark size in px
  const ox = (W - m) / 2, oy = (H - m) / 2;
  return (x, y) => {
    // inside the centred mark? map to 512-space and reuse the icon sampler
    if (x >= ox && x <= ox + m && y >= oy && y <= oy + m) {
      const c = sample(((x - ox) / m) * S, ((y - oy) / m) * S, false);
      if (c[3] > 0) return c;
    }
    return [...BG, 255];
  };
}

// Foreground-only (bell on transparent) for Android adaptive icon.
// Bell is scaled to sit inside the 66% safe zone, centred.
function sampleForeground(x, y) {
  // map full-canvas coords into a centred, scaled bell space (~70% size)
  const cx = 256, cy = 256, scale = 1 / 0.62;
  const bx = (x - cx) * scale + 256;
  const by = (y - cy) * scale + 268; // nudge down so optical centre is mid
  return insideBell(bx, by) ? [...WHITE, 255] : [0, 0, 0, 0];
}

// ── Renderer with 4x4 supersampling ──────────────────────────────────────────
function render(size, mode) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4;
  const inv = S / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * inv;
          const y = (py + (sy + 0.5) / SS) * inv;
          const c = mode === 'fg' ? sampleForeground(x, y)
                  : mode === 'round' ? sample(x, y, true)
                  : sample(x, y, false);
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const n = SS * SS;
      const o = (py * size + px) * 4;
      if (a > 0) { buf[o] = Math.round(r / a); buf[o + 1] = Math.round(g / a); buf[o + 2] = Math.round(b / a); }
      buf[o + 3] = Math.round(a / n);
    }
  }
  return buf;
}

// Generic rectangular renderer with a custom sampler (4x4 supersampling).
function renderRect(W, H, sampler) {
  const buf = Buffer.alloc(W * H * 4);
  const SS = 4;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sampler(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const n = SS * SS, o = (py * W + px) * 4;
      if (a > 0) { buf[o] = Math.round(r / a); buf[o + 1] = Math.round(g / a); buf[o + 2] = Math.round(b / a); }
      buf[o + 3] = Math.round(a / n);
    }
  }
  return buf;
}

// Read width/height from a PNG's IHDR.
function readPngSize(file) {
  const b = fs.readFileSync(file);
  return { W: b.readUInt32BE(16), H: b.readUInt32BE(20) };
}

// ── Minimal PNG encoder (truecolor + alpha) ──────────────────────────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines, filter byte 0 per row
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function encodePNG2(W, H, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function write(file, size, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(size, render(size, mode)));
  console.log(`  ${path.relative(process.cwd(), file)}  (${size}px)`);
}

// ── Outputs ──────────────────────────────────────────────────────────────────
const root = path.resolve(__dirname, '..');
const android = path.join(root, 'android/app/src/main/res');

console.log('PWA icons:');
[48, 72, 96, 128, 144, 152, 192, 384, 512].forEach((sz) =>
  write(path.join(root, `src/assets/icons/icon-${sz}x${sz}.png`), sz, 'full')
);

if (fs.existsSync(android)) {
  console.log('Android legacy launcher icons:');
  const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, sz] of Object.entries(dens)) {
    write(path.join(android, `mipmap-${d}/ic_launcher.png`), sz, 'full');
    write(path.join(android, `mipmap-${d}/ic_launcher_round.png`), sz, 'round');
  }
  console.log('Android adaptive foreground:');
  const fg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [d, sz] of Object.entries(fg)) {
    write(path.join(android, `mipmap-${d}/ic_launcher_foreground.png`), sz, 'fg');
  }

  console.log('Android splash screens (blue bg + centred mark):');
  // Regenerate every existing splash.png in place, preserving its dimensions.
  const dirs = fs.readdirSync(android).filter((d) => /drawable.*/.test(d));
  for (const dir of dirs) {
    const f = path.join(android, dir, 'splash.png');
    if (!fs.existsSync(f)) continue;
    const { W, H } = readPngSize(f);
    fs.writeFileSync(f, encodePNG2(W, H, renderRect(W, H, makeSplashSampler(W, H, 0.30))));
    console.log(`  ${dir}/splash.png  (${W}x${H})`);
  }
}

console.log('Done.');
