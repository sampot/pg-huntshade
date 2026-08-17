// 追匿 — 入口：PG、輸入、rAF、頁內面板。

import { createGame, stepTime, summarize, getOutcome } from "./src/engine.js";
import { createRenderer } from "./src/render.js";
import { createAudio } from "./src/audio.js";
import {
  createInputState, zeroInput, keyAction, axesFromKeys, normalizeAxes, stickVector,
} from "./src/input.js";
import { loadProgress, saveProgress, mergeProgress } from "./src/persist.js";

const PG = typeof window !== "undefined" ? window.PG : undefined;
if (PG?.ready) {
  try {
    await PG.ready;
  } catch {
    /* 離線靜態也可玩 */
  }
}

const $ = (id) => document.getElementById(id);

if (navigator.maxTouchPoints > 0 || "ontouchstart" in window) {
  document.body.classList.add("touch-capable");
}

const canvas = $("stage");
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInputState();

let progress = await loadProgress(PG);
let game = createGame({ seed: Date.now() % 1000000 });
let mode = "lobby";
let raf = 0;
let lastFrame = performance.now();
let toastTimer = 0;
let nippleManager = null;

const heldKeys = new Set();
let stickActive = false;
let stickPointer = null;
let stickOrigin = { x: 0, y: 0 };
const STICK_RADIUS = 52;

const PANELS = ["panelLobby", "panelHelp", "panelCredits", "panelPause", "panelResult"];

function showPanel(id) {
  for (const key of PANELS) $(key).hidden = key !== id;
  $("overlay").classList.toggle("active", !!id);
  $("touch").style.visibility = id ? "hidden" : "visible";
}

function hidePanels() {
  showPanel(null);
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

function selectedRole() {
  const picked = document.querySelector('input[name="role"]:checked');
  return picked?.value === "runner" ? "runner" : "hunter";
}

function selectedDifficulty() {
  return $("pickDiff").value || "normal";
}

function updateLobby() {
  $("lobbyBest").textContent = progress.bestScore.toLocaleString("en-US");
  $("lobbyHunter").textContent = String(progress.hunterWins);
  $("lobbyRunner").textContent = String(progress.runnerWins);
}

function updateHud() {
  const view = summarize(game);
  $("hudRole").textContent = view.roleName;
  $("hudTime").textContent = `${Math.floor(view.timeLeft / 60)}:${String(view.timeLeft % 60).padStart(2, "0")}`;
  $("hudLeft").textContent = `匿 ${view.runnersLeft}/${view.runnerTotal}`;
  $("hudScore").textContent = view.score.toLocaleString("en-US");
  $("banner").textContent = view.msg || "";
  document.body.classList.toggle("runner-role", view.role === "runner");
  const skill = view.role === "hunter" ? `掃描 ${view.you.scanCd}s` : `衝刺 ${view.you.dashCd}s`;
  $("btnSkill").textContent = view.you.dashing || view.hunter.scanning ? "中" : skill;
}

function mergeInputFromKeys() {
  if (stickActive) return;
  const axes = axesFromKeys(heldKeys);
  input.moveX = axes.moveX;
  input.moveY = axes.moveY;
}

function releaseStick() {
  stickActive = false;
  stickPointer = null;
  $("stickBase").hidden = true;
  $("stickRest").hidden = false;
  if (!heldKeys.size) {
    input.moveX = 0;
    input.moveY = 0;
  }
}

async function setupNipple() {
  if (!PG?.libs?.load || nippleManager) return;
  try {
    const nipplejs = await PG.libs.load("nipple");
    nippleManager = nipplejs.create({
      zone: $("stick"),
      mode: "dynamic",
      size: 96,
      restOpacity: 0.45,
      color: "rgba(255,224,102,0.35)",
    });
    nippleManager.on("move", (_evt, data) => {
      const f = data.force > 1 ? 1 : data.force;
      const rad = data.angle.radian;
      input.moveX = Math.cos(rad) * f;
      input.moveY = -Math.sin(rad) * f;
      stickActive = true;
    });
    nippleManager.on("end", () => {
      stickActive = false;
      if (!heldKeys.size) {
        input.moveX = 0;
        input.moveY = 0;
      }
    });
    $("stickRest").hidden = true;
  } catch {
    bindFallbackStick();
  }
}

function bindFallbackStick() {
  const zone = $("stick");
  zone.addEventListener("pointerdown", (e) => {
    if (mode !== "playing") return;
    stickActive = true;
    stickPointer = e.pointerId;
    stickOrigin = { x: e.clientX, y: e.clientY };
    $("stickBase").hidden = false;
    $("stickRest").hidden = true;
    $("stickBase").style.left = `${e.clientX}px`;
    $("stickBase").style.top = `${e.clientY}px`;
    zone.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  zone.addEventListener("pointermove", (e) => {
    if (!stickActive || e.pointerId !== stickPointer) return;
    const v = stickVector(stickOrigin.x, stickOrigin.y, e.clientX, e.clientY, STICK_RADIUS);
    input.moveX = v.moveX;
    input.moveY = v.moveY;
    $("stickKnob").style.transform = `translate(calc(-50% + ${v.moveX * STICK_RADIUS}px), calc(-50% + ${v.moveY * STICK_RADIUS}px))`;
  });
  const end = (e) => {
    if (e.pointerId !== stickPointer) return;
    releaseStick();
    $("stickKnob").style.transform = "translate(-50%, -50%)";
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
}

function newGame() {
  game = createGame({
    role: selectedRole(),
    difficulty: selectedDifficulty(),
    seed: Date.now() % 1000000,
  });
  mode = "playing";
  zeroInput(input);
  heldKeys.clear();
  releaseStick();
  hidePanels();
  document.body.classList.toggle("runner-role", game.role === "runner");
  lastFrame = performance.now();
  loop();
}

async function startGame() {
  await audio.unlock();
  audio.play("click");
  await setupNipple();
  await renderer.loadImages();
  newGame();
  audio.play("ok");
  updateHud();
}

async function endRun(outcome) {
  mode = "result";
  zeroInput(input);
  heldKeys.clear();
  releaseStick();
  cancelAnimationFrame(raf);
  raf = 0;
  const view = summarize(game);
  const won = outcome === "won";
  progress = mergeProgress(progress, {
    score: game.score,
    role: game.role,
    won,
    catches: game.catches,
  });
  const save = await saveProgress(PG, progress);
  if (!save.ok) toast("紀錄同步失敗，本機仍可繼續玩");
  updateLobby();
  $("resultTitle").textContent = won ? "勝利" : "落敗";
  $("resultMsg").textContent = view.msg;
  $("resultScore").textContent = view.score.toLocaleString("en-US");
  $("resultCatches").textContent = String(view.catches);
  $("resultEscapes").textContent = String(view.escapes);
  showPanel("panelResult");
}

function suspend() {
  zeroInput(input);
  heldKeys.clear();
  releaseStick();
  input.secondary = false;
  if (mode === "playing") {
    mode = "paused";
    showPanel("panelPause");
  }
  cancelAnimationFrame(raf);
  raf = 0;
  audio.suspend();
}

function resumeFromPause() {
  if (mode === "paused") {
    mode = "playing";
    hidePanels();
    lastFrame = performance.now();
    loop();
    audio.resume();
  }
}

function loop(now = performance.now()) {
  if (mode !== "playing") return;
  const delta = Math.min(48, now - lastFrame);
  lastFrame = now;
  mergeInputFromKeys();
  const normalized = normalizeAxes(input.moveX, input.moveY);
  stepTime(game, { ...input, ...normalized }, delta);
  audio.handleEvents(game.events);
  renderer.render(game);
  updateHud();
  const outcome = getOutcome(game);
  if (outcome !== "playing") {
    void endRun(outcome);
    return;
  }
  raf = requestAnimationFrame(loop);
}

$("btnStart").addEventListener("click", () => void startGame());
$("btnHelp").addEventListener("click", () => showPanel("panelHelp"));
$("btnHelpClose").addEventListener("click", () => showPanel("panelLobby"));
$("btnCredits").addEventListener("click", () => showPanel("panelCredits"));
$("btnCreditsClose").addEventListener("click", () => showPanel("panelLobby"));
$("btnPause").addEventListener("click", () => suspend());
$("btnResume").addEventListener("click", () => resumeFromPause());
$("btnQuit").addEventListener("click", () => {
  mode = "lobby";
  hidePanels();
  showPanel("panelLobby");
  audio.resume();
});
$("btnAgain").addEventListener("click", () => void startGame());
$("btnMenu").addEventListener("click", () => {
  mode = "lobby";
  hidePanels();
  showPanel("panelLobby");
});

$("btnSound").addEventListener("click", async () => {
  const on = $("btnSound").getAttribute("aria-pressed") !== "true";
  $("btnSound").setAttribute("aria-pressed", String(on));
  audio.setEnabled(on);
  if (on) await audio.unlock();
});

$("btnSkill").addEventListener("pointerdown", (e) => {
  if (mode !== "playing") return;
  input.secondary = true;
  e.preventDefault();
});
$("btnSkill").addEventListener("pointerup", () => {
  input.secondary = false;
});
$("btnSkill").addEventListener("pointercancel", () => {
  input.secondary = false;
});

window.addEventListener("keydown", (e) => {
  const action = keyAction(e.code);
  if (!action) return;
  if (mode === "lobby" && e.code === "Enter") {
    e.preventDefault();
    void startGame();
    return;
  }
  if (mode !== "playing") return;
  if (["left", "right", "up", "down"].includes(action)) {
    heldKeys.add(action);
    mergeInputFromKeys();
    e.preventDefault();
  } else if (action === "secondary") {
    input.secondary = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  const action = keyAction(e.code);
  if (!action) return;
  if (["left", "right", "up", "down"].includes(action)) {
    heldKeys.delete(action);
    mergeInputFromKeys();
  } else if (action === "secondary") {
    input.secondary = false;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") suspend();
});
window.addEventListener("pagehide", suspend);
window.addEventListener("blur", () => {
  if (mode === "playing") {
    zeroInput(input);
    heldKeys.clear();
    releaseStick();
  }
});

window.addEventListener("resize", () => {
  if (mode === "playing") renderer.render(game);
});

updateLobby();
showPanel("panelLobby");
await renderer.loadImages();
