import { describe, it, expect } from "vitest";
import {
  createInputState, zeroInput, keyAction, axesFromKeys,
  normalizeAxes, stickVector, DEAD_ZONE,
} from "../src/input.js";

describe("input", () => {
  it("zeroInput 歸零所有欄位", () => {
    const input = createInputState();
    input.moveX = 1;
    input.secondary = true;
    zeroInput(input);
    expect(input).toEqual({ moveX: 0, moveY: 0, primary: false, secondary: false });
  });

  it("keyAction 對應 WASD 與技能鍵", () => {
    expect(keyAction("KeyW")).toBe("up");
    expect(keyAction("KeyD")).toBe("right");
    expect(keyAction("KeyK")).toBe("secondary");
    expect(keyAction("KeyQ")).toBe(null);
  });

  it("axesFromKeys 合成方向", () => {
    const held = new Set(["up", "right"]);
    expect(axesFromKeys(held)).toEqual({ moveX: 1, moveY: -1 });
  });

  it("normalizeAxes 套用死區", () => {
    expect(normalizeAxes(0.05, 0)).toEqual({ moveX: 0, moveY: 0 });
    const v = normalizeAxes(1, 0);
    expect(v.moveX).toBeCloseTo(1);
  });

  it("stickVector 在死區內歸零", () => {
    const v = stickVector(0, 0, 2, 2, 100);
    expect(v.force).toBeLessThan(DEAD_ZONE + 0.01);
    expect(v.moveX).toBe(0);
  });
});
