/* =========================================================
 * rAF vs setInterval（單頁、單模式、公平高負載）
 * - 結構沿用：performance-stage + status-display + control-panel
 * - 指標：Avg FPS / P95 / Long Frames / VSync 對齊率
 * ======================================================= */

// ===== 參數 =====
const DURATION_MS = 10_000; // 單次 10s
const WARMUP_MS = 1_000; // 暖機 1s
const LOAD = {
  // 高負載（兩模式共用）
  count: 9000, // 粒子數
  speed: 120, // 基準速度 px/s
  radius: [2, 4], // 半徑範圍
  alpha: 0.8, // 透明度
  comp: "source-over",
  resScale: 2, // 解析度倍率（乘上 DPR）
};
document.getElementById("m-count").textContent = String(LOAD.count);
document.getElementById("m-scale").textContent = `${LOAD.resScale}×`;

// ===== DOM =====
const stageDom = null; // 本頁不用 DOM 粒子層
const canvas = document.getElementById("stage-canvas");
const stageOverlay = document.getElementById("stage-overlay");
const testModeSelect = document.getElementById("test-mode");
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const modeLabel = document.getElementById("mode-label");
const modeCard = document.getElementById("mode-card");
const fpsLabel = document.getElementById("fps-label");
const timerLabel = document.getElementById("timer-label");

// Metrics
const mFPS = document.getElementById("m-fps");
const mP95 = document.getElementById("m-p95");
const mLong = document.getElementById("m-long");
const mVSync = document.getElementById("m-vsync");

// Hardware
const hzEl = document.getElementById("hz");
const dprEl = document.getElementById("dpr");
const cpuEl = document.getElementById("cpu");
const memEl = document.getElementById("mem");
const uaEl = document.getElementById("ua");

// ===== Canvas 設定（對齊你既有做法：固定 CSS 尺寸 + DPR 縮放）=====
const CSS_W = 900,
  CSS_H = 600; // 舞台邏輯尺寸，與既有頁面一致
let ctx,
  devicePixelRatio = 1;
function setupCanvas() {
  devicePixelRatio = window.devicePixelRatio || 1;
  const scale = devicePixelRatio * LOAD.resScale;

  canvas.width = Math.round(CSS_W * scale);
  canvas.height = Math.round(CSS_H * scale);
  canvas.style.width = CSS_W + "px";
  canvas.style.height = CSS_H + "px";

  ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
setupCanvas();
window.addEventListener("resize", setupCanvas);

// ===== FPS 計算（沿用你現有風格：會套 fps-high/medium/low）=====
function makeFPSCounter(labelEl) {
  let frames = 0,
    last = 0,
    fps = 0;
  return function tick(ts) {
    if (!last) last = ts;
    frames++;
    const elapsed = ts - last;
    if (elapsed >= 1000) {
      fps = Math.round((frames * 1000) / elapsed);
      frames = 0;
      last = ts;
      labelEl.textContent = fps;
      const box = labelEl.closest(".fps-display");
      box.classList.remove("fps-high", "fps-medium", "fps-low");
      if (fps >= 50) box.classList.add("fps-high");
      else if (fps >= 30) box.classList.add("fps-medium");
      else box.classList.add("fps-low");
    }
    return fps;
  };
}
const updateFPS = makeFPSCounter(fpsLabel);

// ===== 估算刷新間隔（供 vsync rate 計算）=====
async function estimateRefreshMs(samples = 90) {
  return new Promise((resolve) => {
    const deltas = [];
    let last;
    function tick(ts) {
      if (last) deltas.push(ts - last);
      last = ts;
      if (deltas.length >= samples) {
        deltas.sort((a, b) => a - b);
        const mid = Math.floor(deltas.length / 2);
        resolve(deltas[mid]);
      } else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// ===== 場景資料 =====
function rand(a, b) {
  return a + Math.random() * (b - a);
}
function makeParticles() {
  const arr = new Array(LOAD.count);
  for (let i = 0; i < LOAD.count; i++) {
    const r = rand(LOAD.radius[0], LOAD.radius[1]);
    const base = LOAD.speed * (0.6 + Math.random() * 0.8);
    const ang = Math.random() * Math.PI * 2;
    arr[i] = {
      x: Math.random() * CSS_W,
      y: Math.random() * CSS_H,
      vx: Math.cos(ang) * base,
      vy: Math.sin(ang) * base,
      r,
    };
  }
  return arr;
}

// ===== 測試主程式 =====
let running = false,
  rafId = null,
  intervalId = null;
async function runTest() {
  if (running) return;
  running = true;

  // UI 狀態
  btnStart.disabled = true;
  btnStop.disabled = false;
  stageOverlay.style.display = "none";

  // 模式與顏色（沿用 mode-display 的概念）
  const mode = testModeSelect.value; // 'interval' | 'raf'
  modeLabel.textContent = mode.toUpperCase();
  modeCard.classList.remove("mode-interval", "mode-raf");
  modeCard.classList.add(`mode-${mode}`);

  // 硬體資訊
  const refreshMs = await estimateRefreshMs();
  hzEl.textContent = `${(1000 / refreshMs).toFixed(1)} Hz`;
  dprEl.textContent = String(window.devicePixelRatio || 1);
  cpuEl.textContent = navigator.hardwareConcurrency || "—";
  memEl.textContent = navigator.deviceMemory || "—";
  uaEl.textContent =
    navigator.userAgentData && navigator.userAgentData.brands
      ? navigator.userAgentData.brands
          .map((b) => `${b.brand} ${b.version}`)
          .join(", ")
      : navigator.userAgent;

  // 場景
  const parts = makeParticles();
  ctx.globalAlpha = LOAD.alpha;
  ctx.globalCompositeOperation = LOAD.comp;

  // 指標收集
  const frameDeltas = [];
  let longFrames = 0;
  const longThresh = Math.max(25, refreshMs * 1.5);

  // 計時
  let start = performance.now();
  let last = start;
  const warmupEnd = start + WARMUP_MS;
  const testEnd = start + DURATION_MS;

  // 計時器（右側 TIME 與 FPS 顯示）
  function updateTimer(now) {
    const elapsed = Math.max(0, (now - start) / 1000);
    const remaining = Math.max(0, DURATION_MS / 1000 - elapsed);
    timerLabel.textContent = `${remaining.toFixed(1)}s`;
    const box = timerLabel.closest(".timer-display");
    box.classList[running ? "add" : "remove"]("running");
  }

  function update(dt) {
    // 位置更新
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < p.r) {
        p.x = p.r;
        p.vx *= -1;
      }
      if (p.x > CSS_W - p.r) {
        p.x = CSS_W - p.r;
        p.vx *= -1;
      }
      if (p.y < p.r) {
        p.y = p.r;
        p.vy *= -1;
      }
      if (p.y > CSS_H - p.r) {
        p.y = CSS_H - p.r;
        p.vy *= -1;
      }
    }
    // 繪製
    ctx.clearRect(0, 0, CSS_W, CSS_H);
    ctx.beginPath();
    for (const p of parts) {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = "#4e79a7";
    ctx.fill();
  }

  function collect(now, dtMs) {
    if (now <= warmupEnd) return; // 暖機不記
    frameDeltas.push(dtMs);
    if (dtMs > longThresh) longFrames++;
  }

  function finish() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (intervalId) clearInterval(intervalId);
    rafId = null;
    intervalId = null;
    btnStart.disabled = false;
    btnStop.disabled = true;
    stageOverlay.style.display = "";

    // 指標計算
    if (frameDeltas.length) {
      const avg = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
      const fps = 1000 / avg;
      const p95 = percentile(frameDeltas, 0.95);
      const vsync = vsyncRate(frameDeltas, refreshMs);

      mFPS.textContent = Math.round(fps).toString();
      mP95.textContent = `${p95.toFixed(1)} ms`;
      mLong.textContent = String(longFrames);
      mVSync.textContent = `${vsync}%`;
    } else {
      mFPS.textContent = "—";
      mP95.textContent = "—";
      mLong.textContent = "—";
      mVSync.textContent = "—";
    }
  }

  if (mode === "raf") {
    function loop(ts) {
      if (!running) return;
      const dt = Math.max(0, (ts - last) / 1000);
      last = ts;
      update(dt);
      collect(ts, dt * 1000);
      updateTimer(ts);
      updateFPS(ts);
      if (ts >= testEnd) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame((ts) => {
      last = ts;
      loop(ts);
    });
  } else {
    function step() {
      const now = performance.now();
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      update(dt);
      collect(now, dt * 1000);
      updateTimer(now);
      updateFPS(now);
      if (now >= testEnd) {
        finish();
      }
    }
    intervalId = setInterval(step, 16); // 常見「約 60fps」寫法
  }

  // 超時保護
  setTimeout(() => running && finish(), DURATION_MS + 600);
}

// ===== 工具 =====
function percentile(arr, p) {
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.max(
    0,
    Math.min(a.length - 1, Math.floor((a.length - 1) * p))
  );
  return a[idx];
}
function vsyncRate(deltas, refreshMs) {
  const eps = 0.6;
  let ok = 0;
  for (const d of deltas) {
    const k = Math.max(1, Math.round(d / refreshMs));
    const target = k * refreshMs;
    if (Math.abs(d - target) <= eps) ok++;
  }
  return Math.round((ok / deltas.length) * 100);
}

// ===== 事件（沿用你既有交互：overlay 可開跑、按鈕控制）=====
stageOverlay.addEventListener("click", () => {
  if (!running) runTest();
});
btnStart.addEventListener("click", () => {
  if (!running) runTest();
});
btnStop.addEventListener("click", () => {
  if (!running) return;
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (intervalId) clearInterval(intervalId);
  rafId = null;
  intervalId = null;
  btnStart.disabled = false;
  btnStop.disabled = true;
  stageOverlay.style.display = "";
});

// 初始顯示
modeLabel.textContent = "READY";
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !running) {
    e.preventDefault();
    runTest();
  }
});
