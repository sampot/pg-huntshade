import { describe, it, expect } from "vitest";
import {
  createGame, tick, stepTime, summarize, getOutcome,
  buildGrid, cellAt, moveWithCollision, dist, isRunnerVisible,
  activeRunners,   mulberry32,
} from "../src/engine.js";
import { EMPTY, WALL, EXIT, GRID_W, GRID_H, TILE, MATCH_SECONDS } from "../src/config.js";

const NEUTRAL = { moveX: 0, moveY: 0, primary: false, secondary: false };

function run(state, input, ticks) {
  for (let i = 0; i < ticks; i += 1) tick(state, input || NEUTRAL);
  return state;
}

describe("地圖與碰撞", () => {
  it("buildGrid 解析出口與牆", () => {
    const { grid, exits } = buildGrid();
    expect(grid.length).toBe(GRID_W * GRID_H);
    expect(exits.length).toBeGreaterThanOrEqual(2);
    expect(cellAt(grid, exits[0].x, exits[0].y)).toBe(EXIT);
    expect(cellAt(grid, 0, 0)).toBe(WALL);
  });

  it("moveWithCollision 不會穿牆", () => {
    const { grid } = buildGrid();
    const start = { x: TILE * 1.5, y: TILE * 1.5 };
    const next = moveWithCollision(grid, start.x, start.y, -TILE, 0);
    expect(next.x).toBeGreaterThanOrEqual(start.x - 1);
  });

  it("mulberry32 同種子可重現", () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("開局", () => {
  it("追捕模式：玩家是獵人", () => {
    const s = createGame({ role: "hunter", seed: 1 });
    expect(s.hunter.kind).toBe("human");
    expect(s.runners.every((r) => r.kind === "ai")).toBe(true);
    expect(getOutcome(s)).toBe("playing");
  });

  it("逃亡模式：玩家是匿者", () => {
    const s = createGame({ role: "runner", seed: 2 });
    expect(s.runners[0].kind).toBe("human");
    expect(s.hunter.kind).toBe("ai");
    expect(s.role).toBe("runner");
  });

  it("summarize 帶 HUD 欄位", () => {
    const view = summarize(createGame({ seed: 3 }));
    expect(view.timeLeft).toBe(MATCH_SECONDS);
    expect(view.runners.length).toBe(3);
    expect(view.outcome).toBe("playing");
  });
});

describe("視野", () => {
  it("匿者在視野外不可見", () => {
    const s = createGame({ role: "hunter", seed: 4 });
    s.hunter.x = 50;
    s.hunter.y = 50;
    const r = s.runners[0];
    r.x = 500;
    r.y = 400;
    expect(isRunnerVisible(s, r)).toBe(false);
  });

  it("掃描後全圖可見", () => {
    const s = createGame({ role: "hunter", seed: 5 });
    s.hunter.revealAllMs = 1000;
    const r = s.runners[0];
    r.x = 500;
    r.y = 400;
    expect(isRunnerVisible(s, r)).toBe(true);
  });

  it("衝刺中匿者不可見", () => {
    const s = createGame({ role: "hunter", seed: 6 });
    const r = s.runners[0];
    r.x = s.hunter.x + 20;
    r.y = s.hunter.y;
    r.dashMs = 500;
    expect(isRunnerVisible(s, r)).toBe(false);
  });
});

describe("技能", () => {
  it("追捕者掃描進入冷卻", () => {
    const s = createGame({ role: "hunter", seed: 7 });
    tick(s, { ...NEUTRAL, secondary: true });
    tick(s, NEUTRAL);
    expect(s.hunter.scanMs).toBeGreaterThan(0);
    expect(s.hunter.scanCd).toBeGreaterThan(0);
  });

  it("逃亡者衝刺加速狀態", () => {
    const s = createGame({ role: "runner", seed: 8 });
    tick(s, { ...NEUTRAL, secondary: true });
    tick(s, NEUTRAL);
    expect(s.runners[0].dashMs).toBeGreaterThan(0);
  });
});

describe("逮捕與逃脫", () => {
  it("獵人貼近可逮捕", () => {
    const s = createGame({ role: "hunter", seed: 9 });
    const r = s.runners[0];
    r.x = s.hunter.x + 5;
    r.y = s.hunter.y;
    r.dashMs = 0;
    run(s, NEUTRAL, 1);
    expect(r.caught).toBe(true);
    expect(s.catches).toBe(1);
  });

  it("踩出口即逃脫（玩家匿者勝）", () => {
    const s = createGame({ role: "runner", seed: 10 });
    const exit = s.exits[0];
    const you = s.runners[0];
    you.x = exit.x * TILE + TILE / 2;
    you.y = exit.y * TILE + TILE / 2;
    tick(s, NEUTRAL);
    expect(you.escaped).toBe(true);
    expect(getOutcome(s)).toBe("won");
  });
});

describe("勝敗", () => {
  it("抓完三名匿者追捕者勝", () => {
    const s = createGame({ role: "hunter", seed: 11 });
    for (const r of s.runners) r.caught = true;
    tick(s, NEUTRAL);
    expect(getOutcome(s)).toBe("won");
  });

  it("時間到逃亡者仍存活則匿者勝", () => {
    const s = createGame({ role: "runner", seed: 12 });
    s.elapsed = MATCH_SECONDS + 1;
    s.timeLeft = 0;
    tick(s, NEUTRAL);
    expect(getOutcome(s)).toBe("won");
  });

  it("時間到追捕者未抓完則落敗", () => {
    const s = createGame({ role: "hunter", seed: 13 });
    s.elapsed = MATCH_SECONDS + 1;
    s.timeLeft = 0;
    tick(s, NEUTRAL);
    expect(getOutcome(s)).toBe("lost");
  });

  it("stepTime 可累積多 tick", () => {
    const s = createGame({ role: "hunter", seed: 14 });
    const before = s.elapsed;
    stepTime(s, { ...NEUTRAL, moveX: 1 }, 100);
    expect(s.elapsed).toBeGreaterThan(before);
  });

  it("activeRunners 排除已捕／已逃", () => {
    const s = createGame({ seed: 15 });
    s.runners[0].caught = true;
    s.runners[1].escaped = true;
    expect(activeRunners(s).length).toBe(1);
  });
});

describe("移動", () => {
  it("玩家追捕者可移動", () => {
    const s = createGame({ role: "hunter", seed: 16 });
    const x0 = s.hunter.x;
    run(s, { moveX: 1, moveY: 0, primary: false, secondary: false }, 20);
    expect(s.hunter.x).toBeGreaterThan(x0);
  });

  it("dist 計算距離", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
