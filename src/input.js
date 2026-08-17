// 鍵盤／觸控 → 單一 input 狀態。

export const DEAD_ZONE = 0.16;

export function createInputState() {
  return { moveX: 0, moveY: 0, primary: false, secondary: false };
}

export function zeroInput(input) {
  input.moveX = 0;
  input.moveY = 0;
  input.primary = false;
  input.secondary = false;
  return input;
}

export function keyAction(code) {
  switch (code) {
    case "ArrowLeft":
    case "KeyA":
      return "left";
    case "ArrowRight":
    case "KeyD":
      return "right";
    case "ArrowUp":
    case "KeyW":
      return "up";
    case "ArrowDown":
    case "KeyS":
      return "down";
    case "Space":
    case "KeyJ":
    case "KeyZ":
      return "primary";
    case "KeyK":
    case "KeyX":
    case "ShiftLeft":
    case "ShiftRight":
      return "secondary";
    default:
      return null;
  }
}

export function axesFromKeys(held) {
  const on = (name) => held.has(name);
  return {
    moveX: (on("right") ? 1 : 0) - (on("left") ? 1 : 0),
    moveY: (on("down") ? 1 : 0) - (on("up") ? 1 : 0),
  };
}

export function normalizeAxes(moveX, moveY) {
  const mx = Number.isFinite(moveX) ? moveX : 0;
  const my = Number.isFinite(moveY) ? moveY : 0;
  const len = Math.hypot(mx, my);
  if (len < DEAD_ZONE) return { moveX: 0, moveY: 0 };
  const scale = Math.min(1, len) / len;
  return { moveX: mx * scale, moveY: my * scale };
}

export function stickVector(originX, originY, pointerX, pointerY, radius) {
  const dx = pointerX - originX;
  const dy = pointerY - originY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.0001) return { moveX: 0, moveY: 0, force: 0 };
  const force = Math.min(1, dist / radius);
  if (force < DEAD_ZONE) return { moveX: 0, moveY: 0, force: 0 };
  return { moveX: (dx / dist) * force, moveY: (dy / dist) * force, force };
}
