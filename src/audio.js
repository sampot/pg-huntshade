// 音效：Web Audio + HTMLAudioElement，背景隱藏時暫停。

const PATHS = {
  music: "./assets/audio/music.ogg",
  click: "./assets/audio/click.ogg",
  ok: "./assets/audio/ok.ogg",
  scan: "./assets/audio/scan.ogg",
  dash: "./assets/audio/dash.ogg",
  catch: "./assets/audio/catch.ogg",
  alarm: "./assets/audio/alarm.ogg",
  soft: "./assets/audio/soft.ogg",
};

export function createAudio() {
  let enabled = true;
  let unlocked = false;
  const music = new Audio(PATHS.music);
  music.loop = true;
  music.volume = 0.22;
  const fx = {};
  for (const [name, src] of Object.entries(PATHS)) {
    if (name === "music") continue;
    fx[name] = Object.assign(new Audio(src), { volume: name === "catch" ? 0.5 : 0.38 });
  }

  async function unlock() {
    unlocked = true;
    if (enabled) {
      try {
        await music.play();
      } catch {
        /* 等使用者手勢 */
      }
    }
  }

  function setEnabled(on) {
    enabled = on;
    if (!on) music.pause();
    else if (unlocked) void music.play().catch(() => {});
  }

  function play(name) {
    if (!enabled || !fx[name]) return;
    const a = fx[name];
    a.currentTime = 0;
    void a.play().catch(() => {});
  }

  function suspend() {
    music.pause();
  }

  function resume() {
    if (enabled && unlocked) void music.play().catch(() => {});
  }

  function handleEvents(events) {
    for (const e of events || []) {
      if (e.type === "catch") play("catch");
      else if (e.type === "escape") play("alarm");
      else if (e.type === "scan") play("scan");
      else if (e.type === "skill") play(e.who === "hunter" ? "scan" : "dash");
      else if (e.type === "end") play(e.outcome === "won" ? "ok" : "soft");
    }
  }

  return { unlock, setEnabled, play, suspend, resume, handleEvents };
}
