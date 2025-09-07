// ===== DOM refs =====
const canvas = document.getElementById("stage-canvas");
const stageWrap = document.getElementById("stage-wrap");
const stageOverlay = document.getElementById("stage-overlay");

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
// alpha: false：告訴瀏覽器畫布不需要透明，可讓底層合成流程更快（能省掉與背景合成的開銷）。
// desynchronized: true：請求較少阻塞的繪製路徑（Chrome 支援較佳）。不是保證，但有時能減少卡頓。
// 小重點：Safari 與部分環境對 desynchronized 支援度有限；即使被忽略也不影響功能

function dpr() {
  return Math.max(1, Math.floor(window.devicePixelRatio || 1));
}

function fitCanvas() {
  const rect = stageWrap.getBoundingClientRect();
  const ratio = dpr();

  // CSS 尺寸（畫布的版面大小）
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  // 實體像素尺寸（位圖大小）
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
  // 1) 底色
  target.fillStyle = "#0f131b";
  target.fillRect(0, 0, w, h);

  // 2) 細格線（一次 path、一次 stroke）
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
  target.stroke(); // 一次 beginPath + 一次 stroke()，比每條線都 stroke 一次有效率
  target.globalAlpha = 1; // 用 globalAlpha 調整透明度，不改顏色字串本身，避免每次產生新顏色字串

  // 3) 隨機小方塊（營造「背景有料」的感覺）
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
// 示範「全量重繪」的昂貴
function renderFull() {
  const ratio = dpr();
  const w = canvas.width / ratio;
  const h = canvas.height / ratio;
  paintBackground(ctx, w, h, tiles); // 每幀都重畫背景（重）
  drawBall(ctx, w, h);
}

// 示範「先生成背景、每幀直接貼」的便宜
function renderCached() {
  const ratio = dpr();
  const w = canvas.width / ratio;
  const h = canvas.height / ratio;

  ctx.drawImage(bgCanvas, 0, 0, w, h); // 每幀搬運快取（輕）
  drawBall(ctx, w, h);
}

function drawBall(target, w, h) {
  // 位置更新：位移 = 速度 * dt。用 dtSec 保證不同 FPS 下速度一致
  ball.x += ball.vx * dtSec;
  ball.y += ball.vy * dtSec;

  // 邊界反彈
  const r = ball.r;
  if (ball.x < r || ball.x > w - r) ball.vx *= -1;
  if (ball.y < r || ball.y > h - r) ball.vy *= -1;

  // 畫球（圓形與陰影）
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

  // FPS 每 ~300ms 平滑更新一次
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

  // 隱藏覆蓋層（點擊開始後消失）
  if (stageOverlay) stageOverlay.style.display = "none";

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

  // 顯示覆蓋層（停止後回到可再次點擊的狀態）
  if (stageOverlay) stageOverlay.style.display = "flex";
}

// ===== UI =====
if (stageOverlay) {
  // 讓「點擊舞台」的體驗與另一頁一致
  stageOverlay.addEventListener("click", startLoop);
  // 可選：鍵盤也能觸發（無障礙）
  stageOverlay.tabIndex = 0;
  stageOverlay.setAttribute("role", "button");
  stageOverlay.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startLoop();
    }
  });
}

function setMode(next) {
  mode = next;
  // 只有在運行時才即時更新 modeLabel；未開始就維持 READY
  if (isRunning) {
    modeLabel.textContent = next.toUpperCase();
  }
  if (next === "cached") rebuildBackground(); // 切成 cached 時即刻重建背景，確保快取與當前尺寸/tiles 同步
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
// 初始保持 overlay 顯示（灰色 + hover），待使用者點擊開始
