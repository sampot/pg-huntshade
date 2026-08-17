// Canvas 渲染：巷弄地圖、迷霧視野、實體。

import {
  TILE, GRID_W, GRID_H, WORLD_W, WORLD_H,
  EMPTY, WALL, EXIT, VISION_RADIUS, ENTITY_RADIUS,
} from "./config.js";
import { cellAt } from "./engine.js";

const COLORS = {
  wall: "#1a2430",
  wallEdge: "#2f4154",
  floor: "#0f171f",
  floorAlt: "#121c26",
  exit: "#2a6f5b",
  exitGlow: "#45d4a8",
  hunter: "#ff5a5f",
  runner: "#5ecbff",
  runnerHidden: "#2a4255",
  player: "#ffe066",
  fog: "rgba(4,8,12,0.78)",
  scan: "rgba(255,90,95,0.12)",
  catch: "#ffd166",
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let images = {};
  let loaded = false;

  async function loadImages() {
    if (loaded) return;
    const names = ["hero", "rival", "npc"];
    await Promise.all(
      names.map(
        (name) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              images[name] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `./assets/images/${name}.png`;
          }),
      ),
    );
    loaded = true;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height, dpr };
  }

  function drawMap(state, cam) {
    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        const cell = cellAt(state.grid, x, y);
        const px = x * TILE - cam.x;
        const py = y * TILE - cam.y;
        if (cell === WALL) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = COLORS.wallEdge;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        } else {
          ctx.fillStyle = (x + y) % 2 ? COLORS.floorAlt : COLORS.floor;
          ctx.fillRect(px, py, TILE, TILE);
          if (cell === EXIT) {
            ctx.fillStyle = COLORS.exit;
            ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
            ctx.strokeStyle = COLORS.exitGlow;
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
          }
        }
      }
    }
  }

  function drawEntity(entity, cam, role, isPlayer, visible) {
    const px = entity.x - cam.x;
    const py = entity.y - cam.y;
    const imgKey = role === "hunter" ? "rival" : isPlayer ? "hero" : "npc";
    const img = images[imgKey];
    const size = ENTITY_RADIUS * 2.6;
    ctx.save();
    if (role === "runner" && !visible && !entity.caught && !entity.escaped) {
      ctx.globalAlpha = 0.35;
    }
    if (entity.dashMs > 0) {
      ctx.globalAlpha = 0.55;
      ctx.shadowColor = COLORS.runner;
      ctx.shadowBlur = 12;
    }
    if (img && img.complete) {
      ctx.drawImage(img, px - size / 2, py - size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.fillStyle =
        role === "hunter"
          ? COLORS.hunter
          : isPlayer
            ? COLORS.player
            : visible
              ? COLORS.runner
              : COLORS.runnerHidden;
      ctx.arc(px, py, ENTITY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (entity.caught) {
      ctx.strokeStyle = COLORS.catch;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, ENTITY_RADIUS + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawFog(state, cam, viewW, viewH) {
    const hx = state.hunter.x - cam.x;
    const hy = state.hunter.y - cam.y;
    if (state.role === "hunter" || state.hunter.revealAllMs > 0) {
      if (state.hunter.revealAllMs > 0) {
        ctx.fillStyle = COLORS.scan;
        ctx.fillRect(0, 0, viewW, viewH);
      }
      return;
    }
    ctx.fillStyle = COLORS.fog;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalCompositeOperation = "destination-out";
    const grad = ctx.createRadialGradient(hx, hy, 24, hx, hy, VISION_RADIUS);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.65, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, VISION_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function cameraFor(state, viewW, viewH) {
    const focus =
      state.role === "hunter"
        ? state.hunter
        : state.runners.find((r) => r.kind === "human") || state.hunter;
    const cx = clamp(focus.x - viewW / 2, 0, Math.max(0, WORLD_W - viewW));
    const cy = clamp(focus.y - viewH / 2, 0, Math.max(0, WORLD_H - viewH));
    return { x: cx, y: cy };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function render(state) {
    const { width, height } = resize();
    ctx.clearRect(0, 0, width, height);
    const cam = cameraFor(state, width, height);
    drawMap(state, cam);
    for (const r of state.runners) {
      if (r.caught || r.escaped) continue;
      const show = state.role === "hunter" ? r.visible || state.hunter.revealAllMs > 0 : true;
      drawEntity(r, cam, "runner", r.kind === "human", show);
    }
    drawEntity(state.hunter, cam, "hunter", state.hunter.kind === "human", true);
    drawFog(state, cam, width, height);
    if (state.hunter.scanMs > 0 && state.role === "hunter") {
      const hx = state.hunter.x - cam.x;
      const hy = state.hunter.y - cam.y;
      ctx.strokeStyle = "rgba(255,90,95,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, VISION_RADIUS * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return { loadImages, render, resize };
}
