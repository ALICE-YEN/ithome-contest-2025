/* =========================================================
 * Canvas vs DOM Performance Comparison
 * - 比較 DOM + CSS transform 與 Canvas 在大量動畫元素的效能差異
 * - 10,000 個移動的小方塊，10秒後自動停止
 * ======================================================= */

// ===== 參數設定 =====
const CSS_W = 640,
  CSS_H = 360;
const COUNT = 10000;
const SIZE = 2;
const AUTO_STOP_TIME = 10000; // 10秒後自動停止
const AUTO_SWITCH_INTERVAL = 5000; // 自動切換間隔

// ===== DOM 元素引用 =====
const stageDom = document.getElementById("stage-dom");
const canvas = document.getElementById("stage-canvas");
const stageOverlay = document.getElementById("stage-overlay");
const testModeSelect = document.getElementById("test-mode");
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const modeLabel = document.getElementById("mode-label");
const fpsLabel = document.getElementById("fps-label");
const timerLabel = document.getElementById("timer-label");

// ===== 固定隨機種子 =====
function makeSeed(n) {
  const arr = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * (CSS_W - SIZE);
    const y = Math.random() * (CSS_H - SIZE);
    const speed = 0.6;
    const vx = (Math.random() * 2 - 1) * speed;
    const vy = (Math.random() * 2 - 1) * speed;
    arr[i] = { x, y, vx, vy };
  }
  return arr;
}
const SEED = makeSeed(COUNT);

// ===== 狀態管理 =====
let animationId = null;
let autoStopTimer = null;
let autoSwitchTimer = null;
let testStartTime = 0;
let currentTestMode = "dom";
let isRunning = false;
let domParticles = null;
let canvasParticles = null;
let domDots = [];

// ===== FPS 計算器 =====
function makeFPSCounter() {
  let frameCount = 0;
  let lastTime = 0;
  let currentFPS = 0;

  return function updateFPS(currentTime) {
    if (lastTime === 0) lastTime = currentTime;

    frameCount++;
    const elapsed = currentTime - lastTime;

    if (elapsed >= 1000) {
      currentFPS = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      lastTime = currentTime;

      // 更新 FPS 顯示
      fpsLabel.textContent = currentFPS;

      // 更新 FPS 狀態樣式
      const fpsDisplay = fpsLabel.closest(".fps-display");
      fpsDisplay.classList.remove("fps-high", "fps-medium", "fps-low");
      if (currentFPS >= 50) {
        fpsDisplay.classList.add("fps-high");
      } else if (currentFPS >= 30) {
        fpsDisplay.classList.add("fps-medium");
      } else {
        fpsDisplay.classList.add("fps-low");
      }
    }

    return currentFPS;
  };
}
const updateFPS = makeFPSCounter();

// ===== Canvas 設定 =====
let ctx,
  devicePixelRatio = 1;

function setupCanvas() {
  devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(CSS_W * devicePixelRatio);
  canvas.height = Math.round(CSS_H * devicePixelRatio);
  canvas.style.width = CSS_W + "px";
  canvas.style.height = CSS_H + "px";
  ctx = canvas.getContext("2d");
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

setupCanvas();
window.addEventListener("resize", setupCanvas);

// ===== DOM 粒子系統 =====
function createDomDots() {
  if (domDots.length > 0) return;

  const fragment = document.createDocumentFragment();
  domDots = new Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.transform = `translate3d(${SEED[i].x}px, ${SEED[i].y}px, 0)`;
    domDots[i] = dot;
    fragment.appendChild(dot);
  }

  stageDom.appendChild(fragment);
}

function removeDomDots() {
  stageDom.innerHTML = "";
  domDots = [];
}

// ===== 粒子狀態重置 =====
function resetParticleStates() {
  domParticles = SEED.map((particle) => ({ ...particle }));
  canvasParticles = SEED.map((particle) => ({ ...particle }));
}

// ===== 計時器更新 =====
function updateTimer(currentTime) {
  const elapsed = Math.max(0, (currentTime - testStartTime) / 1000);
  const remaining = Math.max(0, AUTO_STOP_TIME / 1000 - elapsed);
  timerLabel.textContent = `${remaining.toFixed(1)}s`;

  const timerDisplay = timerLabel.closest(".timer-display");
  if (isRunning) {
    timerDisplay.classList.add("running");
  } else {
    timerDisplay.classList.remove("running");
  }

  // 檢查是否超時，強制停止
  if (remaining <= 0 && isRunning) {
    stopTest();
  }
}

// ===== 模式切換 =====
function setDisplayMode(mode) {
  currentTestMode = mode;

  // 更新模式顯示
  modeLabel.textContent = mode.toUpperCase();
  const modeDisplay = modeLabel.closest(".mode-display");
  modeDisplay.classList.remove("mode-dom", "mode-canvas");
  modeDisplay.classList.add(`mode-${mode}`);

  // 切換顯示層
  stageDom.style.display = "none";
  canvas.style.display = "none";
  stageDom.setAttribute("aria-hidden", "true");
  canvas.setAttribute("aria-hidden", "true");

  if (mode === "dom") {
    stageDom.style.display = "block";
    stageDom.setAttribute("aria-hidden", "false");
    createDomDots();
  } else if (mode === "canvas") {
    canvas.style.display = "block";
    canvas.setAttribute("aria-hidden", "false");
    removeDomDots();
    ctx.clearRect(0, 0, CSS_W, CSS_H);
  }
}

// ===== 動畫循環 =====
function animationLoop(timestamp) {
  if (!isRunning) {
    stopTest(); // 確保完全停止
    return;
  }

  updateFPS(timestamp);
  updateTimer(timestamp);

  // 雙重檢查：如果時間到了就停止
  const elapsed = (timestamp - testStartTime) / 1000;
  if (elapsed >= AUTO_STOP_TIME / 1000) {
    stopTest();
    return;
  }

  if (currentTestMode === "dom") {
    // DOM 版本
    for (let i = 0; i < COUNT; i++) {
      const particle = domParticles[i];

      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x <= 0 || particle.x >= CSS_W - SIZE) {
        particle.vx *= -1;
      }
      if (particle.y <= 0 || particle.y >= CSS_H - SIZE) {
        particle.vy *= -1;
      }

      domDots[
        i
      ].style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0)`;
    }
  } else if (currentTestMode === "canvas") {
    // Canvas 版本
    ctx.clearRect(0, 0, CSS_W, CSS_H);
    ctx.fillStyle = "#4e79a7";

    for (let i = 0; i < COUNT; i++) {
      const particle = canvasParticles[i];

      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x <= 0 || particle.x >= CSS_W - SIZE) {
        particle.vx *= -1;
      }
      if (particle.y <= 0 || particle.y >= CSS_H - SIZE) {
        particle.vy *= -1;
      }

      ctx.fillRect(particle.x, particle.y, SIZE, SIZE);
    }
  }

  animationId = requestAnimationFrame(animationLoop);
}

// ===== 測試控制 =====
function startTest() {
  if (isRunning) return;

  isRunning = true;
  testStartTime = performance.now();

  // 重置狀態
  resetParticleStates();
  fpsLabel.textContent = "0";
  timerLabel.textContent = `${AUTO_STOP_TIME / 1000}s`;

  // 更新 UI
  btnStart.disabled = true;
  btnStop.disabled = false;
  testModeSelect.disabled = true;
  stageOverlay.style.display = "none";

  // 設定模式
  const selectedMode = testModeSelect.value;
  if (selectedMode === "auto") {
    // 自動切換模式
    currentTestMode = "dom";
    setDisplayMode("dom");
    autoSwitchTimer = setInterval(() => {
      if (isRunning) {
        currentTestMode = currentTestMode === "dom" ? "canvas" : "dom";
        setDisplayMode(currentTestMode);
        resetParticleStates(); // 切換時重置粒子位置
      }
    }, AUTO_SWITCH_INTERVAL);
  } else {
    currentTestMode = selectedMode;
    setDisplayMode(selectedMode);
  }

  // 開始動畫
  animationId = requestAnimationFrame(animationLoop);

  // 設定自動停止
  autoStopTimer = setTimeout(() => {
    stopTest();
  }, AUTO_STOP_TIME);

  console.log(`Performance test started: ${selectedMode.toUpperCase()} mode`);
}

function stopTest() {
  if (!isRunning) return;

  isRunning = false;

  // 清除計時器和動畫
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
  if (autoSwitchTimer) {
    clearInterval(autoSwitchTimer);
    autoSwitchTimer = null;
  }

  // 更新 UI
  btnStart.disabled = false;
  btnStop.disabled = true;
  testModeSelect.disabled = false;
  stageOverlay.style.display = "flex";

  // 強制隱藏所有層
  stageDom.style.display = "none";
  canvas.style.display = "none";
  stageDom.setAttribute("aria-hidden", "true");
  canvas.setAttribute("aria-hidden", "true");

  // 清理資源
  removeDomDots();
  if (ctx) {
    ctx.clearRect(0, 0, CSS_W, CSS_H);
  }

  // 重置狀態顯示
  modeLabel.textContent = "READY";
  fpsLabel.textContent = "0";
  timerLabel.textContent = "0s";
  const modeDisplay = modeLabel.closest(".mode-display");
  const fpsDisplay = fpsLabel.closest(".fps-display");
  const timerDisplay = timerLabel.closest(".timer-display");

  modeDisplay.classList.remove("mode-dom", "mode-canvas");
  fpsDisplay.classList.remove("fps-high", "fps-medium", "fps-low");
  timerDisplay.classList.remove("running");

  console.log("Performance test stopped");
}

// ===== 事件監聽器 =====
btnStart.addEventListener("click", startTest);
btnStop.addEventListener("click", stopTest);

// 點擊 overlay 也可以開始測試
stageOverlay.addEventListener("click", startTest);

// ===== 鍵盤快捷鍵 =====
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !isRunning) {
    e.preventDefault();
    startTest();
  } else if (e.code === "Escape" && isRunning) {
    e.preventDefault();
    stopTest();
  }
});

// ===== 初始化 =====
function initialize() {
  // 設定初始狀態
  modeLabel.textContent = "READY";
  fpsLabel.textContent = "0";
  timerLabel.textContent = "0s";

  console.log(`Performance test initialized:
- Particles: ${COUNT.toLocaleString()}
- Canvas size: ${CSS_W} × ${CSS_H}
- Auto stop: ${AUTO_STOP_TIME / 1000}s
- Auto switch: ${AUTO_SWITCH_INTERVAL / 1000}s
- Device pixel ratio: ${devicePixelRatio}
- Keyboard shortcuts: Space (start), Escape (stop)`);
}

initialize();
