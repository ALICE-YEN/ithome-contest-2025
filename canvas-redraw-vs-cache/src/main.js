// ===== DOM refs =====
const canvas = document.getElementById("stage-canvas");
const stageWrap = document.getElementById("stage-wrap");

const modeLabel = document.getElementById("mode-label");
const fpsLabel = document.getElementById("fps-label");
const tilesLabel = document.getElementById("tiles-label");

const modeSelect = document.getElementById("mode-select");
const btnRegen = document.getElementById("btn-regenerate");
const rangeTiles = document.getElementById("tiles-range");

const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");

// ===== Canvas / DPR =====
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

function dpr() {
  return Math.max(1, Math.floor(window.devicePixelRatio || 1));
}

function fitCanvas() {
  const rect = stageWrap.getBoundingClientRect();
  const ratio = dpr();

  // CSS 尺寸
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  // 實體像素尺寸
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));

  // 一單位 = 1 CSS px
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (mode === "cached") rebuildBackground();
}
window.addEventListener("resize", () => {
  clearTimeout(fitCanvas._t);
  fitCanvas._t = setTimeout(fitCanvas, 120);
});

// ===== State =====
let mode = "cached"; // 'full' | 'cached'
let tiles = parseInt(rangeTiles.value, 10);

let isRunning = false;
let rafId = 0;
let lastTs = 0;
let dtSec = 0;

// Offscreen 背景快取
let bgCanvas = null;
let bgCtx = null;

// 前景小球
let ball = { x: 60, y: 60, r: 16, vx: 180, vy: 120 };

// FPS（每 ~300ms 更新一次）
const fps = { frames: 0, last: 0, value: 0 };

// ===== 背景產生 =====
function rebuildBackground() {
  const ratio = dpr();
  const w = canvas.width / ratio;
  const h = canvas.height / ratio;

  bgCanvas = document.createElement("canvas");
  bgCanvas.width = Math.max(1, Math.floor(w * ratio));
  bgCanvas.height = Math.max(1, Math.floor(h * ratio));
  bgCtx = bgCanvas.getContext("2d", { alpha: false });
  bgCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  paintBackground(bgCtx, w, h, tiles);
}

function paintBackground(target, w, h, count) {
  // 底色
  target.fillStyle = "#0f131b";
  target.fillRect(0, 0, w, h);

  // 細格線
  target.globalAlpha = 0.35;
  target.strokeStyle = "#1e2430";
  target.lineWidth = 1;
  const step = 24;
  target.beginPath();
  for (let x = 0; x <= w; x += step) {
    target.moveTo(x, 0);
    target.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += step) {
    target.moveTo(0, y);
    target.lineTo(w, y);
  }
  target.stroke();
  target.globalAlpha = 1;

  // 大量小方塊
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = 2 + Math.random() * 2;
    const hue = 210 + Math.floor(Math.random() * 40);
    target.fillStyle = `hsla(${hue} 45% 60% / 0.15)`;
    target.fillRect(x, y, s, s);
  }
}

// ===== Renderers =====
function renderFull() {
  const ratio = dpr();
  const w = canvas.width / ratio;
  const h = canvas.height / ratio;
  paintBackground(ctx, w, h, tiles);
  drawBall(ctx, w, h);
}

function renderCached() {
  ctx.drawImage(bgCanvas, 0, 0);
  const ratio = dpr();
  drawBall(ctx, canvas.width / ratio, canvas.height / ratio);
}

function drawBall(target, w, h) {
  // 更新位置
  ball.x += ball.vx * dtSec;
  ball.y += ball.vy * dtSec;

  const r = ball.r;
  if (ball.x < r || ball.x > w - r) ball.vx *= -1;
  if (ball.y < r || ball.y > h - r) ball.vy *= -1;

  // 畫球
  target.beginPath();
  target.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  target.closePath();
  target.fillStyle = "#5aa9e6";
  target.shadowColor = "rgba(90,169,230,.4)";
  target.shadowBlur = 12;
  target.fill();
  target.shadowBlur = 0;
}

// ===== rAF 迴圈 =====
function tick(ts) {
  if (!isRunning) return;

  if (!lastTs) lastTs = ts;
  dtSec = (ts - lastTs) / 1000;
  lastTs = ts;

  // FPS
  fps.frames++;
  if (ts - fps.last > 300) {
    fps.value = Math.round((fps.frames * 1000) / (ts - fps.last));
    fpsLabel.textContent = String(fps.value);
    fps.frames = 0;
    fps.last = ts;
  }

  if (mode === "full") renderFull();
  else renderCached();

  rafId = requestAnimationFrame(tick);
}

function startLoop() {
  if (isRunning) return;
  isRunning = true;

  // 重置
  lastTs = 0;
  fps.frames = 0;
  fps.last = 0;

  // UI
  btnStart.disabled = true;
  btnStop.disabled = false;

  // 狀態
  modeLabel.textContent = mode.toUpperCase();

  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (!isRunning) return;
  isRunning = false;
  cancelAnimationFrame(rafId);

  btnStart.disabled = false;
  btnStop.disabled = true;

  // 顯示為 READY，FPS 保留最後值方便對照
  modeLabel.textContent = "READY";
}

// ===== UI =====
function setMode(next) {
  mode = next;
  // 只有在運行時才即時更新 modeLabel；未開始就維持 READY
  if (isRunning) {
    modeLabel.textContent = next.toUpperCase();
  }
  if (next === "cached") rebuildBackground();
}
modeSelect.addEventListener("change", (e) => setMode(e.target.value));

rangeTiles.addEventListener("input", (e) => {
  tiles = parseInt(e.target.value, 10);
  tilesLabel.textContent = String(tiles);
});

btnRegen.addEventListener("click", rebuildBackground);
btnStart.addEventListener("click", startLoop);
btnStop.addEventListener("click", stopLoop);

// ===== Boot =====
fitCanvas();
rebuildBackground();
modeSelect.value = "cached"; // 預設模式
// 不自動開始：等待使用者按 Start Test
