// 追匿 — 常數與地圖定義（純資料，無 DOM）。

export const TILE = 32;
export const GRID_W = 20;
export const GRID_H = 15;
export const WORLD_W = GRID_W * TILE;
export const WORLD_H = GRID_H * TILE;

export const TICK_MS = 1000 / 60;
export const MATCH_SECONDS = 90;

export const HUNTER_SPEED = 118;
export const RUNNER_SPEED = 102;
export const DASH_MULT = 1.85;
export const DASH_MS = 780;
export const DASH_COOLDOWN_MS = 5200;

export const SCAN_MS = 3200;
export const SCAN_COOLDOWN_MS = 8500;
export const SCAN_REVEAL_ALL_MS = 2800;

export const VISION_RADIUS = 128;
export const CATCH_RADIUS = 22;
export const ENTITY_RADIUS = 11;

export const SCORE_CATCH = 220;
export const SCORE_ESCAPE = 480;
export const SCORE_SURVIVE = 360;
export const SCORE_TIME_BONUS = 8;

/** 0 空地、1 牆、2 出口（逃亡者踩到即逃脫）。 */
export const EMPTY = 0;
export const WALL = 1;
export const EXIT = 2;

/** 地圖字串：#=牆 .=空地 E=出口 */
export const MAP_LAYOUT = [
  "####################",
  "#E......#..........#",
  "#.####..#.####.###.#",
  "#.#..#..#....#...#.#",
  "#.#..####.####.#.#.#",
  "#.#......#....#.#..#",
  "#.######.#.####.#..#",
  "#......#.#......#..#",
  "###.##.#.####.##.#.#",
  "#......#......#....#",
  "#.####.######.####.#",
  "#.#....#......#....#",
  "#.#.##.#.####.#.##.#",
  "#......#......#..E.#",
  "####################",
];

export const RUNNER_NAMES = ["影一", "影二", "影三"];
export const HUNTER_NAME = "獵影";

export const DIFFICULTIES = {
  easy: { label: "巷弄", aiSkill: 0.72, hunterBonus: 0.92 },
  normal: { label: "迷霧", aiSkill: 1, hunterBonus: 1 },
  hard: { label: "夜巡", aiSkill: 1.28, hunterBonus: 1.08 },
};
