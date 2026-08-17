// 進度持久化：權威在 PG.kv。

export const PROGRESS_KEY = "huntshade:progress:v1";

export function defaultProgress() {
  return { bestScore: 0, hunterWins: 0, runnerWins: 0, plays: 0, catches: 0 };
}

export function parseProgress(raw) {
  if (!raw) return defaultProgress();
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return defaultProgress();
  }
  if (!parsed || typeof parsed !== "object") return defaultProgress();
  const base = defaultProgress();
  for (const key of Object.keys(base)) {
    const value = Number(parsed[key]);
    if (Number.isFinite(value) && value >= 0) base[key] = Math.floor(value);
  }
  return base;
}

export function mergeProgress(progress, run) {
  const base = parseProgress(progress);
  const score = Math.max(0, Math.floor(Number(run?.score) || 0));
  const won = !!run?.won;
  const role = run?.role === "runner" ? "runner" : "hunter";
  return {
    bestScore: Math.max(base.bestScore, score),
    hunterWins: base.hunterWins + (won && role === "hunter" ? 1 : 0),
    runnerWins: base.runnerWins + (won && role === "runner" ? 1 : 0),
    plays: base.plays + 1,
    catches: base.catches + Math.max(0, Math.floor(Number(run?.catches) || 0)),
  };
}

export async function loadProgress(pg) {
  try {
    if (!pg?.kv?.get) return defaultProgress();
    return parseProgress(await pg.kv.get(PROGRESS_KEY));
  } catch {
    return defaultProgress();
  }
}

export async function saveProgress(pg, progress) {
  try {
    if (!pg?.kv?.put) return { ok: false, error: "kv_unavailable" };
    await pg.kv.put(PROGRESS_KEY, JSON.stringify(progress));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err && (err.code || err.message)) || "save_failed" };
  }
}
