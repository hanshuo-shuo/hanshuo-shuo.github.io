import { buildWorld, createGame, stepGame, wrapAngle } from "./engine.mjs";
import { renderEye, renderMap } from "./renderer.mjs";

const root = document.querySelector(".playground");
const view = document.querySelector(".arena-view");
const overlay = document.querySelector("#overlay");
const title = document.querySelector("#overlay-title");
const description = document.querySelector("#overlay-description");
const start = document.querySelector("#start");
const pause = document.querySelector("#pause");
const restart = document.querySelector("#restart");
const status = document.querySelector("#status");
const timer = document.querySelector("#timer");
const captures = document.querySelector("#captures");
const showMap = document.querySelector("#show-map");
const mapPanel = document.querySelector(".map-panel");
const eyes = [document.querySelector("#left-eye").getContext("2d"), document.querySelector("#right-eye").getContext("2d")];
const map = document.querySelector("#map").getContext("2d");
const embedded = window.parent !== window;
if (embedded) document.body.classList.add("embedded");
const keys = new Set();
const held = new Set();
const pulses = new Map();
const bindings = new Map([
  ["ArrowUp", "forward"],
  ["KeyW", "forward"],
  ["ArrowDown", "backward"],
  ["KeyS", "backward"],
  ["ArrowLeft", "left"],
  ["KeyA", "left"],
  ["ArrowRight", "right"],
  ["KeyD", "right"],
  ["KeyQ", "peek-left"],
  ["KeyE", "peek-right"],
  ["Space", "stop"],
]);
let game;
let world;
let seed = 21;
let lastTime = 0;
let lastPaint = 0;
let lastPhase = "";
let lastCaptures = 0;
let dirty = true;

function clearInput() {
  keys.clear();
  held.clear();
  pulses.clear();
  document.querySelectorAll(".is-pressed").forEach((button) => button.classList.remove("is-pressed"));
}

function setStatus(text) {
  if (status.textContent !== text) status.textContent = text;
}

function syncState() {
  root.dataset.phase = game.phase;
  pause.disabled = !["running", "paused"].includes(game.phase);
  pause.textContent = game.phase === "paused" ? "Resume" : "Pause";
  restart.disabled = false;
  overlay.hidden = game.phase === "running";
  if (game.phase === "ready") {
    title.textContent = "A mouse’s-eye view.";
    description.textContent = "Find the green EXIT doorway. Peek around obstacles, and keep away from the tracked robot.";
    start.textContent = "Play";
    setStatus("Ready. Use the arrow keys or WASD, or the buttons below.");
  } else if (game.phase === "paused") {
    title.textContent = "Paused";
    description.textContent = "Take a moment. Resume when you’re ready.";
    start.textContent = "Resume";
    setStatus("Paused. Press P or Resume to continue.");
  } else if (game.phase === "won") {
    title.textContent = "You found the exit.";
    description.textContent = `${game.time.toFixed(1)} seconds · ${game.captures === 0 ? "a clean escape" : `${game.captures} capture${game.captures === 1 ? "" : "s"}`}. Try another run?`;
    start.textContent = "Play again";
    setStatus(`Goal reached in ${game.time.toFixed(1)} seconds, with ${game.captures} captures.`);
  } else if (game.phase === "timeout") {
    title.textContent = "Time for another route.";
    description.textContent = "The exit is on the far side of the maze. Turn on the map if you need a hand.";
    start.textContent = "Try again";
    setStatus("Time is up. Start another run or use the map to plan a route.");
  } else {
    setStatus("Find the green EXIT doorway. Q / E lets you peek without moving.");
  }
  start.disabled = false;
  lastPhase = game.phase;
  dirty = true;
}

function newRun() {
  clearInput();
  game = createGame(world, seed);
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  lastCaptures = 0;
  captures.textContent = "0";
  timer.textContent = "0:00";
  syncState();
}

function play() {
  if (!game) return;
  if (["won", "timeout"].includes(game.phase)) newRun();
  clearInput();
  game.phase = "running";
  syncState();
  view.focus({ preventScroll: true });
}

function togglePause() {
  if (!game || !["running", "paused"].includes(game.phase)) return;
  if (game.phase === "paused") play();
  else {
    clearInput();
    game.phase = "paused";
    syncState();
  }
}

function currentAction(now) {
  const active = new Set([...keys].map((key) => bindings.get(key)).filter(Boolean));
  held.forEach((control) => active.add(control));
  pulses.forEach((until, control) => {
    if (until > now) active.add(control);
    else pulses.delete(control);
  });
  return {
    forward: Number(active.has("forward")) - Number(active.has("backward")),
    turn: Number(active.has("left")) - Number(active.has("right")),
    peek: Number(active.has("peek-left")) - Number(active.has("peek-right")),
    stop: active.has("stop"),
  };
}

start.addEventListener("click", play);
pause.addEventListener("click", togglePause);
restart.addEventListener("click", () => {
  newRun();
  play();
});
showMap.addEventListener("change", () => {
  mapPanel.hidden = !showMap.checked;
  dirty = true;
});
document.querySelector("#back").addEventListener("click", (event) => {
  if (embedded) {
    event.preventDefault();
    window.parent.postMessage({ type: "mousemind-close" }, window.location.origin);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    event.preventDefault();
    if (embedded) window.parent.postMessage({ type: "mousemind-close" }, window.location.origin);
    else togglePause();
    return;
  }
  if (event.code === "KeyP" && !event.repeat) {
    event.preventDefault();
    togglePause();
    return;
  }
  if (event.code === "KeyN" && !event.repeat && game) {
    event.preventDefault();
    newRun();
    play();
    return;
  }
  if (game?.phase !== "running" || !bindings.has(event.code)) return;
  if (event.code === "Space" && event.target.closest("button,a,input")) return;
  event.preventDefault();
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});
window.addEventListener("blur", () => {
  clearInput();
  if (game?.phase === "running") togglePause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game?.phase === "running") togglePause();
});

document.querySelectorAll("[data-control]").forEach((button) => {
  const control = button.dataset.control;
  let pressedAt = 0;
  let activePointer = null;
  button.addEventListener("pointerdown", (event) => {
    if (game?.phase !== "running" || activePointer !== null) return;
    event.preventDefault();
    activePointer = event.pointerId;
    pressedAt = performance.now();
    held.add(control);
    button.classList.add("is-pressed");
    button.setPointerCapture(event.pointerId);
  });
  const release = (event) => {
    if (event.pointerId !== activePointer) return;
    if (event.type === "pointerup" && performance.now() - pressedAt < 120) pulses.set(control, performance.now() + 180);
    held.delete(control);
    activePointer = null;
    button.classList.remove("is-pressed");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("click", (event) => {
    if (event.detail === 0 && game?.phase === "running") pulses.set(control, performance.now() + 180);
  });
});

document.querySelectorAll(".eyes canvas").forEach((canvas) => {
  let pointer = null;
  let previousX = 0;
  canvas.addEventListener("pointerdown", (event) => {
    if (game?.phase !== "running") return;
    pointer = event.pointerId;
    previousX = event.clientX;
    canvas.setPointerCapture(pointer);
    view.focus({ preventScroll: true });
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer || game?.phase !== "running") return;
    game.player.heading = wrapAngle(game.player.heading - (event.clientX - previousX) * 0.006);
    previousX = event.clientX;
    dirty = true;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(type, () => {
      pointer = null;
    });
});

function frame(now) {
  let delta = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
  lastTime = now;
  if (game?.phase === "running") {
    const action = currentAction(now);
    while (delta > 0) {
      const dt = Math.min(delta, 1 / 120);
      stepGame(game, action, dt);
      delta -= dt;
    }
    dirty = true;
    timer.textContent = `${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, "0")}`;
    if (game.captures !== lastCaptures) {
      lastCaptures = game.captures;
      captures.textContent = String(game.captures);
      setStatus("The robot caught you. Keep going—use the walls to break its line of sight.");
    } else if (game.flash === 0 && status.textContent.startsWith("The robot")) setStatus("Keep going. Reach the green exit, and stay out of sight.");
  }
  if (game && lastPhase !== game.phase) {
    clearInput();
    syncState();
  }
  if (game && dirty && now - lastPaint > 32) {
    renderEye(eyes[0], game, 1);
    renderEye(eyes[1], game, -1);
    if (showMap.checked) renderMap(map, game);
    lastPaint = now;
    dirty = false;
  }
  requestAnimationFrame(frame);
}

try {
  const response = await fetch("./world.json");
  if (!response.ok) throw new Error("Map unavailable");
  world = buildWorld(await response.json());
  newRun();
  requestAnimationFrame(frame);
} catch (error) {
  root.dataset.phase = "error";
  title.textContent = "The maze couldn’t load.";
  description.textContent = "Reload the demo to try again.";
  start.textContent = "Reload";
  start.disabled = false;
  start.addEventListener("click", () => location.reload(), { once: true });
  setStatus("The demo is unavailable. Reload, or return to the website.");
  console.error("MouseMind demo failed to load:", error);
}
