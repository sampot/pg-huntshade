import { describe, it, expect, vi } from "vitest";
import {
  defaultProgress, parseProgress, mergeProgress, loadProgress, saveProgress, PROGRESS_KEY,
} from "../src/persist.js";

describe("persist", () => {
  it("defaultProgress 有預期欄位", () => {
    expect(defaultProgress()).toEqual({
      bestScore: 0, hunterWins: 0, runnerWins: 0, plays: 0, catches: 0,
    });
  });

  it("parseProgress 處理非法 JSON", () => {
    expect(parseProgress("{bad")).toEqual(defaultProgress());
  });

  it("mergeProgress 更新最高分與勝場", () => {
    const next = mergeProgress(defaultProgress(), { score: 900, role: "hunter", won: true, catches: 3 });
    expect(next.bestScore).toBe(900);
    expect(next.hunterWins).toBe(1);
    expect(next.plays).toBe(1);
    expect(next.catches).toBe(3);
  });

  it("mergeProgress 匿者勝場", () => {
    const next = mergeProgress(defaultProgress(), { score: 400, role: "runner", won: true });
    expect(next.runnerWins).toBe(1);
  });

  it("loadProgress 無 PG 時回預設", async () => {
    expect(await loadProgress(null)).toEqual(defaultProgress());
  });

  it("saveProgress 透過 PG.kv 寫入", async () => {
    const put = vi.fn();
    const pg = { kv: { put } };
    const result = await saveProgress(pg, defaultProgress());
    expect(result.ok).toBe(true);
    expect(put).toHaveBeenCalledWith(PROGRESS_KEY, expect.any(String));
  });
});
