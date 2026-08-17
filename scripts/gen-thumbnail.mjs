#!/usr/bin/env node
/** 一次性產生 thumbnail.png（640×480）— 不進 build 管線。 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createGame } from "../src/engine.js";
import { TILE, GRID_W, GRID_H, EMPTY, WALL, EXIT } from "../src/config.js";
import { cellAt } from "../src/engine.js";

const W = 640;
const H = 480;
const state = createGame({ role: "hunter", seed: 42, difficulty: "normal" });
state.hunter.x = 180;
state.hunter.y = 240;
state.runners[0].x = 420;
state.runners[0].y = 120;
state.runners[0].visible = true;
state.runners[1].x = 500;
state.runners[1].y = 320;
state.runners[1].visible = true;
state.runners[2].x = 360;
state.runners[2].y = 380;
state.runners[2].visible = false;

const scale = Math.min(W / (GRID_W * TILE), H / (GRID_H * TILE));
const offX = (W - GRID_W * TILE * scale) / 2;
const offY = (H - GRID_H * TILE * scale) / 2;

function px(x, y, r, g, b, buf) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  const i = (py * W + px) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = 255;
}

function fillRect(x0, y0, w, h, r, g, b, buf) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) px(x, y, r, g, b, buf);
  }
}

function circle(cx, cy, rad, r, g, b, buf) {
  for (let y = -rad; y <= rad; y += 1) {
    for (let x = -rad; x <= rad; x += 1) {
      if (x * x + y * y <= rad * rad) px(cx + x, cy + y, r, g, b, buf);
    }
  }
}

const buf = new Uint8Array(W * H * 4);
fillRect(0, 0, W, H, 6, 10, 14, buf);

for (let ty = 0; ty < GRID_H; ty += 1) {
  for (let tx = 0; tx < GRID_W; tx += 1) {
    const cell = cellAt(state.grid, tx, ty);
    const x = offX + tx * TILE * scale;
    const y = offY + ty * TILE * scale;
    const sz = Math.ceil(TILE * scale);
    if (cell === WALL) fillRect(x, y, sz, sz, 26, 36, 48, buf);
    else if (cell === EXIT) fillRect(x + 2, y + 2, sz - 4, sz - 4, 42, 111, 91, buf);
    else fillRect(x, y, sz, sz, (tx + ty) % 2 ? 18 : 15, 28, 38, buf);
  }
}

for (const r of state.runners) {
  if (r.caught) continue;
  const x = offX + r.x * scale;
  const y = offY + r.y * scale;
  const col = r.visible ? [94, 203, 255] : [42, 66, 85];
  circle(x, y, 8 * scale, ...col, buf);
}
circle(offX + state.hunter.x * scale, offY + state.hunter.y * scale, 9 * scale, 255, 90, 95, buf);

// fog overlay
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const hx = offX + state.hunter.x * scale;
    const hy = offY + state.hunter.y * scale;
    const d = Math.hypot(x - hx, y - hy);
    if (d > 100 * scale) {
      const i = (y * W + x) * 4;
      buf[i] = Math.round(buf[i] * 0.35);
      buf[i + 1] = Math.round(buf[i + 1] * 0.35);
      buf[i + 2] = Math.round(buf[i + 2] * 0.35);
    }
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const raw = Buffer.alloc((W * 4 + 1) * H);
let o = 0;
for (let y = 0; y < H; y += 1) {
  raw[o++] = 0;
  for (let x = 0; x < W; x += 1) {
    const i = (y * W + x) * 4;
    raw[o++] = buf[i];
    raw[o++] = buf[i + 1];
    raw[o++] = buf[i + 2];
    raw[o++] = buf[i + 3];
  }
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const compressed = Buffer.from(deflateSync(raw));
const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", compressed),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(new URL("../thumbnail.png", import.meta.url), png);
console.log("wrote thumbnail.png", png.length, "bytes");
