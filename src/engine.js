// 追匿 — 純模擬核心（俯視追逃、結構化實體、AI、勝敗）。

import {
  TILE, GRID_W, GRID_H, WORLD_W, WORLD_H, TICK_MS, MATCH_SECONDS,
  HUNTER_SPEED, RUNNER_SPEED, DASH_MULT, DASH_MS, DASH_COOLDOWN_MS,
  SCAN_MS, SCAN_COOLDOWN_MS, SCAN_REVEAL_ALL_MS,
  VISION_RADIUS, CATCH_RADIUS, ENTITY_RADIUS,
  SCORE_CATCH, SCORE_ESCAPE, SCORE_SURVIVE, SCORE_TIME_BONUS,
  EMPTY, WALL, EXIT, MAP_LAYOUT, RUNNER_NAMES, HUNTER_NAME, DIFFICULTIES,
} from "./config.js";

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildGrid(layout = MAP_LAYOUT) {
  const grid = [];
  const exits = [];
  for (let y = 0; y < GRID_H; y += 1) {
    const row = layout[y] || "";
    for (let x = 0; x < GRID_W; x += 1) {
      const ch = row[x] || "#";
      let cell = WALL;
      if (ch === ".") cell = EMPTY;
      else if (ch === "E") {
        cell = EXIT;
        exits.push({ x, y });
      }
      grid.push(cell);
    }
  }
  return { grid, exits };
}

export function cellAt(grid, x, y) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return WALL;
  return grid[y * GRID_W + x];
}

export function worldToTile(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE * 0.5, y: ty * TILE + TILE * 0.5 };
}

/** 圓形實體 vs 牆：可滑動。 */
export function moveWithCollision(grid, x, y, dx, dy, radius = ENTITY_RADIUS) {
  let nx = x + dx;
  let ny = y + dy;
  const tryAxis = (ax, ay) => {
    const corners = [
      { x: ax - radius, y: ay - radius },
      { x: ax + radius, y: ay - radius },
      { x: ax - radius, y: ay + radius },
      { x: ax + radius, y: ay + radius },
    ];
    for (const c of corners) {
      const { tx, ty } = worldToTile(c.x, c.y);
      if (cellAt(grid, tx, ty) === WALL) return false;
    }
    return true;
  };
  if (!tryAxis(nx, y)) nx = x;
  if (!tryAxis(nx, ny)) ny = y;
  nx = clamp(nx, radius, WORLD_W - radius);
  ny = clamp(ny, radius, WORLD_H - radius);
  return { x: nx, y: ny };
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createHunter(spawn, kind) {
  return {
    id: "hunter",
    role: "hunter",
    kind,
    name: kind === "human" ? "你（獵）" : HUNTER_NAME,
    x: spawn.x,
    y: spawn.y,
    speed: HUNTER_SPEED,
    caught: false,
    escaped: false,
    dashMs: 0,
    dashCd: 0,
    scanMs: 0,
    scanCd: 0,
    revealAllMs: 0,
    visible: true,
  };
}

function createRunner(id, spawn, kind) {
  return {
    id: `runner-${id}`,
    role: "runner",
    kind,
    name: kind === "human" ? "你（匿）" : RUNNER_NAMES[id] || `影${id + 1}`,
    x: spawn.x,
    y: spawn.y,
    speed: RUNNER_SPEED,
    caught: false,
    escaped: false,
    dashMs: 0,
    dashCd: 0,
    scanMs: 0,
    scanCd: 0,
    revealAllMs: 0,
    visible: false,
  };
}

function spawnPoints(exits, grid, rng) {
  const hunter = tileCenter(2, Math.floor(GRID_H / 2));
  const runnerTiles = [
    exits[0] || { x: 1, y: 1 },
    exits[1] || { x: GRID_W - 2, y: GRID_H - 2 },
    { x: Math.floor(GRID_W / 2), y: GRID_H - 2 },
  ];
  const runners = runnerTiles.slice(0, 3).map((e, i) => {
    let tx = e.x;
    let ty = e.y;
    if (cellAt(grid, tx, ty) !== EMPTY) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (cellAt(grid, tx + dx, ty + dy) === EMPTY) {
            tx += dx;
            ty += dy;
            break;
          }
        }
      }
    }
    const c = tileCenter(tx, ty);
    return {
      x: c.x + (rng() - 0.5) * 8,
      y: c.y + (rng() - 0.5) * 8,
      id: i,
    };
  });
  return { hunter, runners };
}

export function createGame(opts = {}) {
  const role = opts.role === "runner" ? "runner" : "hunter";
  const difficulty = DIFFICULTIES[opts.difficulty] ? opts.difficulty : "normal";
  const seed = Number.isFinite(opts.seed) ? opts.seed : Date.now() % 1000000;
  const rng = mulberry32(seed);
  const { grid, exits } = buildGrid();
  const spawns = spawnPoints(exits, grid, rng);
  const hunter = createHunter(spawns.hunter, role === "hunter" ? "human" : "ai");
  const runners = spawns.runners.map((s, i) =>
    createRunner(i, s, role === "runner" && i === 0 ? "human" : "ai"),
  );
  return {
    seed,
    rng,
    difficulty,
    aiSkill: DIFFICULTIES[difficulty].aiSkill,
    hunterBonus: DIFFICULTIES[difficulty].hunterBonus,
    role,
    phase: "playing",
    outcome: "playing",
    reason: null,
    msg: role === "hunter" ? "抓住所有匿者！" : "撐到時間結束或抵達出口。",
    grid,
    exits,
    hunter,
    runners,
    timeLeft: MATCH_SECONDS,
    elapsed: 0,
    score: 0,
    catches: 0,
    escapes: 0,
    events: [],
    prev: { primary: false, secondary: false },
    accumulator: 0,
  };
}

export function getOutcome(state) {
  return state.outcome;
}

export function activeRunners(state) {
  return state.runners.filter((r) => !r.caught && !r.escaped);
}

export function isRunnerVisible(state, runner) {
  if (runner.caught || runner.escaped) return false;
  if (runner.dashMs > 0) return false;
  if (state.hunter.revealAllMs > 0) return true;
  return dist(state.hunter, runner) <= VISION_RADIUS;
}

export function updateVisibility(state) {
  for (const r of state.runners) {
    r.visible = isRunnerVisible(state, r);
  }
}

function emit(state, type, data = {}) {
  state.events.push({ type, ...data });
}

function endMatch(state, outcome, reason, msg) {
  state.phase = "ended";
  state.outcome = outcome;
  state.reason = reason;
  state.msg = msg;
  emit(state, "end", { outcome, reason });
  return state;
}

function settleScore(state, won) {
  if (won) {
    state.score += Math.round(state.timeLeft * SCORE_TIME_BONUS);
    if (state.role === "runner") state.score += SCORE_SURVIVE;
  }
  return state;
}

function checkEnd(state) {
  const alive = activeRunners(state);
  if (alive.length === 0) {
    const won = state.role === "hunter";
    settleScore(state, won);
    return endMatch(
      state,
      won ? "won" : "lost",
      "caught_all",
      won ? "全部匿者落網！" : "匿者全數落網……",
    );
  }
  if (state.timeLeft <= 0) {
    if (state.role === "runner") {
      settleScore(state, true);
      return endMatch(state, "won", "survived", "撐到霧散，匿跡成功！");
    }
    settleScore(state, false);
    return endMatch(state, "lost", "timeout", "時間到，仍有匿者逃脫。");
  }
  return state;
}

function tryCatch(state, runner) {
  if (runner.caught || runner.escaped || runner.dashMs > 0) return;
  if (dist(state.hunter, runner) > CATCH_RADIUS) return;
  runner.caught = true;
  state.catches += 1;
  state.score += SCORE_CATCH;
  emit(state, "catch", { id: runner.id });
  state.msg = `逮到 ${runner.name}！`;
}

function tryExit(state, runner) {
  if (runner.caught || runner.escaped) return;
  const { tx, ty } = worldToTile(runner.x, runner.y);
  if (cellAt(state.grid, tx, ty) !== EXIT) return;
  runner.escaped = true;
  state.escapes += 1;
  state.score += SCORE_ESCAPE;
  emit(state, "escape", { id: runner.id });
  if (runner.kind === "human") {
    settleScore(state, true);
    endMatch(state, "won", "escaped", "成功從出口脫身！");
  } else {
    state.msg = `${runner.name} 從出口逃脫！`;
  }
}

function useHunterScan(state) {
  const h = state.hunter;
  if (h.scanCd > 0 || h.scanMs > 0) return false;
  h.scanMs = SCAN_MS;
  h.scanCd = SCAN_COOLDOWN_MS;
  h.revealAllMs = SCAN_REVEAL_ALL_MS;
  emit(state, "scan", {});
  state.msg = "掃描啟動——短暫看見所有匿者。";
  return true;
}

function useRunnerDash(entity) {
  if (entity.dashCd > 0 || entity.dashMs > 0) return false;
  entity.dashMs = DASH_MS;
  entity.dashCd = DASH_COOLDOWN_MS;
  return true;
}

function aimVector(from, to) {
  const d = dist(from, to);
  if (d < 0.001) return { x: 0, y: 0 };
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

function fleeVector(from, threat) {
  const d = dist(from, threat);
  if (d < 0.001) return { x: 1, y: 0 };
  return { x: (from.x - threat.x) / d, y: (from.y - threat.y) / d };
}

function nearestExit(state, from) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.exits) {
    const c = tileCenter(e.x, e.y);
    const d = dist(from, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function aiHunterMove(state) {
  const h = state.hunter;
  const targets = activeRunners(state).filter((r) => r.visible);
  let target = null;
  if (targets.length) {
    target = targets.reduce((a, b) => (dist(h, a) < dist(h, b) ? a : b));
  } else {
    const hidden = activeRunners(state);
    if (hidden.length) {
      target = nearestExit(state, h);
    }
  }
  if (!target) return { x: 0, y: 0 };
  const v = aimVector(h, target);
  const wobble = (state.rng() - 0.5) * (1.1 - state.aiSkill);
  return { x: clamp(v.x + wobble * 0.25, -1, 1), y: clamp(v.y + wobble * 0.25, -1, 1) };
}

function aiRunnerMove(state, runner) {
  const h = state.hunter;
  const exit = nearestExit(state, runner);
  const flee = fleeVector(runner, h);
  const toExit = exit ? aimVector(runner, exit) : { x: 0, y: 0 };
  const danger = dist(runner, h);
  const fleeWeight = danger < VISION_RADIUS * 1.4 ? 0.82 * state.aiSkill : 0.35;
  const exitWeight = 1 - fleeWeight;
  let mx = flee.x * fleeWeight + toExit.x * exitWeight;
  let my = flee.y * fleeWeight + toExit.y * exitWeight;
  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;
  if (danger < VISION_RADIUS && runner.dashCd <= 0 && runner.dashMs <= 0 && state.rng() < 0.02 * state.aiSkill) {
    useRunnerDash(runner);
  }
  return { x: mx, y: my };
}

function applySkill(state, entity, input, isHunter) {
  const edgeSecondary = input.secondary && !state.prev.secondary;
  if (!edgeSecondary) return;
  if (isHunter) {
    if (useHunterScan(state)) emit(state, "skill", { who: "hunter" });
  } else if (useRunnerDash(entity)) {
    emit(state, "skill", { who: entity.id });
    if (entity.kind === "human") state.msg = "影遁衝刺！";
  }
}

function tickCooldowns(entity, dt) {
  entity.dashMs = Math.max(0, entity.dashMs - dt);
  entity.dashCd = Math.max(0, entity.dashCd - dt);
  entity.scanMs = Math.max(0, entity.scanMs - dt);
  entity.scanCd = Math.max(0, entity.scanCd - dt);
  entity.revealAllMs = Math.max(0, entity.revealAllMs - dt);
}

function moveEntity(state, entity, mx, my, dt) {
  const speed =
    entity.role === "hunter"
      ? entity.speed * state.hunterBonus
      : entity.speed * (entity.dashMs > 0 ? DASH_MULT : 1);
  const len = Math.hypot(mx, my);
  if (len < 0.08) return;
  const nx = (mx / len) * speed * (dt / 1000);
  const ny = (my / len) * speed * (dt / 1000);
  const pos = moveWithCollision(state.grid, entity.x, entity.y, nx, ny);
  entity.x = pos.x;
  entity.y = pos.y;
}

/** 固定步長模擬一 tick（約 16ms）。 */
export function tick(state, input = { moveX: 0, moveY: 0, primary: false, secondary: false }) {
  if (state.outcome !== "playing") return state;
  state.events = [];
  const dt = TICK_MS;

  tickCooldowns(state.hunter, dt);
  for (const r of state.runners) tickCooldowns(r, dt);

  const h = state.hunter;
  if (h.kind === "human") {
    applySkill(state, h, input, true);
    moveEntity(state, h, input.moveX, input.moveY, dt);
  } else {
    if (h.scanCd <= 0 && activeRunners(state).some((r) => !r.visible) && state.rng() < 0.015 * state.aiSkill) {
      useHunterScan(state);
    }
    const ai = aiHunterMove(state);
    moveEntity(state, h, ai.x, ai.y, dt);
  }

  for (const r of state.runners) {
    if (r.caught || r.escaped) continue;
    if (r.kind === "human") {
      applySkill(state, r, input, false);
      moveEntity(state, r, input.moveX, input.moveY, dt);
    } else {
      const ai = aiRunnerMove(state, r);
      moveEntity(state, r, ai.x, ai.y, dt);
    }
    tryExit(state, r);
    if (state.outcome !== "playing") break;
    tryCatch(state, r);
    if (state.outcome !== "playing") break;
  }

  updateVisibility(state);
  state.elapsed += dt / 1000;
  state.timeLeft = Math.max(0, MATCH_SECONDS - state.elapsed);
  state.prev = {
    primary: !!input.primary,
    secondary: !!input.secondary,
  };
  return checkEnd(state);
}

/** rAF 累積器：傳入毫秒差，內部跑多個 tick。 */
export function stepTime(state, input, deltaMs) {
  if (state.outcome !== "playing") return state;
  state.accumulator += deltaMs;
  let guard = 0;
  while (state.accumulator >= TICK_MS && guard < 8) {
    tick(state, input);
    state.accumulator -= TICK_MS;
    guard += 1;
    if (state.outcome !== "playing") break;
  }
  return state;
}

export function summarize(state) {
  const you =
    state.role === "hunter"
      ? state.hunter
      : state.runners.find((r) => r.kind === "human") || state.runners[0];
  return {
    role: state.role,
    roleName: state.role === "hunter" ? "追捕" : "逃亡",
    difficulty: state.difficulty,
    difficultyName: DIFFICULTIES[state.difficulty].label,
    timeLeft: Math.ceil(state.timeLeft),
    matchSeconds: MATCH_SECONDS,
    score: state.score,
    catches: state.catches,
    escapes: state.escapes,
    runnersLeft: activeRunners(state).length,
    runnerTotal: state.runners.length,
    hunter: {
      x: state.hunter.x,
      y: state.hunter.y,
      scanCd: Math.ceil(state.hunter.scanCd / 1000),
      scanning: state.hunter.scanMs > 0,
      revealAll: state.hunter.revealAllMs > 0,
    },
    runners: state.runners.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      x: r.x,
      y: r.y,
      caught: r.caught,
      escaped: r.escaped,
      visible: r.visible,
      dashing: r.dashMs > 0,
      dashCd: Math.ceil(r.dashCd / 1000),
    })),
    you: {
      id: you.id,
      role: you.role,
      dashCd: Math.ceil(you.dashCd / 1000),
      scanCd: Math.ceil(you.scanCd / 1000),
      dashing: you.dashMs > 0,
    },
    outcome: state.outcome,
    reason: state.reason,
    msg: state.msg,
  };
}
