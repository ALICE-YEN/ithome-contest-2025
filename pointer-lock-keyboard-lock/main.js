const $ = (sel) => document.querySelector(sel);
const logEl = $("#log");
const stage = $("#stage");
const box = $("#box");
const plStatus = $("#plStatus");
const kbStatus = $("#kbStatus");
const sensitivityEl = $("#sensitivity");
const keysInput = $("#keysInput");

const btnEnterPL = $("#btnEnterPL");
const btnExitPL = $("#btnExitPL");
const btnLockKeys = $("#btnLockKeys");
const btnUnlockKeys = $("#btnUnlockKeys");
const btnClear = $("#btnClear");

let yaw = 0; // 左右
let pitch = 0; // 上下
let sensitivity = 1;

function log(msg) {
  const li = document.createElement("li");
  const t = new Date().toLocaleTimeString();
  li.textContent = `[${t}] ${msg}`;
  logEl.appendChild(li);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- Pointer Lock ---
function enterPointerLock() {
  stage.requestPointerLock?.();
}

function exitPointerLock() {
  document.exitPointerLock?.();
}

// 指標鎖定狀態改變事件（成功或解除都會觸發）
document.addEventListener("pointerlockchange", () => {
  // 目前被鎖定的元素是否就是 stage
  const locked = document.pointerLockElement === stage;
  // 加/移除樣式（可用來變更游標等）
  stage.classList.toggle("pointer-locked", !!locked);
  plStatus.textContent = locked ? "已鎖定(游標隱藏)" : "未鎖定";
  log(locked ? "Pointer Lock: 已鎖定" : "Pointer Lock: 已解除");
});

document.addEventListener("pointerlockerror", () => {
  log("Pointer Lock: 失敗(可能需要使用者互動或權限)");
});

// 滑鼠相對移動 → 旋轉方塊
document.addEventListener("mousemove", (e) => {
  // 監聽 mousemove：在 Pointer Lock 狀態下會提供相對位移
  if (document.pointerLockElement !== stage) return;

  // movementX：上一幀到這一幀的水平位移（px）
  yaw += e.movementX * 0.2 * sensitivity;
  // movementY：上一幀到這一幀的垂直位移（px）
  pitch -= e.movementY * 0.2 * sensitivity;
  // 夾住上下角度避免翻面（限制 -80° ~ 80°）
  pitch = Math.max(-80, Math.min(80, pitch));
  box.style.transform = `perspective(900px) rotateX(${pitch}deg) rotateY(${yaw}deg)`;
});

// 允許直接點舞台鎖定
stage.addEventListener("click", () => enterPointerLock());

// --- Keyboard Lock ---
async function lockKeys() {
  if (!("keyboard" in navigator) || !navigator.keyboard?.lock) {
    kbStatus.textContent = "未鎖定 / 此瀏覽器不支援 Keyboard Lock";
    log("Keyboard Lock: 瀏覽器不支援");
    return;
  }
  const keys = keysInput.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    await navigator.keyboard.lock(keys);
    kbStatus.textContent = `已鎖定：${keys.join(", ")}`;
    log(`Keyboard Lock: 已鎖定 → ${keys.join(", ")}`);
  } catch (err) {
    kbStatus.textContent = "未鎖定 / 鎖定失敗";
    log(`Keyboard Lock: 失敗 → ${err?.message || err}`);
  }
}

function unlockKeys() {
  if (navigator.keyboard?.unlock) {
    navigator.keyboard.unlock();
    kbStatus.textContent = "未鎖定";
    log("Keyboard Lock: 已解除");
  }
}

// 顯示支援狀態
if (!("keyboard" in navigator) || !navigator.keyboard?.lock) {
  kbStatus.textContent = "未鎖定 / 此瀏覽器不支援 Keyboard Lock";
} else {
  kbStatus.textContent = "未鎖定 / 支援";
}

// 鍵盤事件觀測(搭配 Keyboard Lock 更直覺)
window.addEventListener("keydown", (e) => {
  // 示範：避免箭頭鍵滾動頁面(即使未鎖，也避免干擾)
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
  ) {
    e.preventDefault();
  }
  log(`keydown → key=${e.key}, code=${e.code}${e.repeat ? " (repeat)" : ""}`);
});

// 控制元件
btnEnterPL.addEventListener("click", enterPointerLock);
btnExitPL.addEventListener("click", exitPointerLock);
btnLockKeys.addEventListener("click", lockKeys);
btnUnlockKeys.addEventListener("click", unlockKeys);
btnClear.addEventListener("click", () => (logEl.innerHTML = ""));
sensitivityEl.addEventListener("input", (e) => {
  sensitivity = Number(e.target.value) || 1;
});

// 初始方塊角度
box.style.transform = "perspective(900px) rotateX(-10deg) rotateY(15deg)";
