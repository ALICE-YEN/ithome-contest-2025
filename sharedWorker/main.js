const $ = (sel) => document.querySelector(sel);

const mainCountEl = $("#mainCount");
const sidebarCountEl = $("#sidebarCount");
const statusEl = $("#status");
const logEl = $("#log");
const workerStatusEl = $("#workerStatus");
const connectionCountEl = $("#connectionCount");

const incrementBtn = $("#incrementBtn");
const decrementBtn = $("#decrementBtn");
const resetBtn = $("#resetBtn");
const newTabBtn = $("#newTabBtn");
const clearLogBtn = $("#clearLogBtn");

let currentCount = 0;
let worker = null;
let port = null;

// 日誌記錄
function log(msg, type = "info") {
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  const icon = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
  li.textContent = `[${time}] ${icon} ${msg}`;
  if (type === "error") li.style.color = "#ef4444";
  if (type === "success") li.style.color = "#10b981";
  logEl.appendChild(li);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(msg) {
  if (statusEl) {
    statusEl.textContent = msg;
  }
}

// 更新顯示
function updateDisplay(value) {
  currentCount = value;
  mainCountEl.textContent = value;
  sidebarCountEl.textContent = value;
}

// 更新連線數
function updateConnectionCount(count) {
  connectionCountEl.textContent = count;
}

// 初始化 SharedWorker
function initSharedWorker() {
  try {
    log("正在連接 SharedWorker...");

    // 創建 SharedWorker
    worker = new SharedWorker("./SharedWorker/worker.js");
    port = worker.port;

    // 監聽來自 SharedWorker 的訊息
    port.onmessage = (e) => {
      const { type, value, connectionCount } = e.data;

      switch (type) {
        case "init":
          // 初始化
          updateDisplay(value);
          updateConnectionCount(connectionCount);
          workerStatusEl.textContent = "已連接";
          log("成功連接到 SharedWorker", "success");
          setStatus("SharedWorker ready");
          break;

        case "update":
          // 更新計數值
          updateDisplay(value);
          log(`收到更新: 計數 = ${value}`, "success");
          setStatus(`Count updated to ${value}`);
          break;

        case "connections":
          // 更新連線數
          updateConnectionCount(connectionCount);
          break;

        case "new_connection":
          // 新分頁連線
          log("偵測到新分頁連線!", "success");
          break;
      }
    };

    // 錯誤處理
    port.onerror = (error) => {
      log(`SharedWorker 錯誤: ${error.message}`, "error");
      workerStatusEl.textContent = "連接錯誤";
    };

    // 開始監聽
    port.start();

    // 通知 worker 新連線
    port.postMessage({ type: "connect" });
  } catch (error) {
    console.error("SharedWorker 初始化失敗:", error);
    log("❌ SharedWorker 不支援或初始化失敗", "error");
    workerStatusEl.textContent = "不支援";

    // 降級方案
    useFallbackMode();
  }
}

// 降級方案：使用 BroadcastChannel
function useFallbackMode() {
  log("⚠️ 使用降級模式 (BroadcastChannel)", "info");

  try {
    const channel = new BroadcastChannel("sharedworker_fallback");

    // 讀取初始值
    const stored = localStorage.getItem("sharedCounter");
    if (stored) {
      updateDisplay(parseInt(stored, 10));
    }

    // 監聽其他分頁的變更
    channel.onmessage = (e) => {
      const { type, value } = e.data;

      if (type === "update") {
        updateDisplay(value);
        log(`收到更新: 計數 = ${value}`, "success");
      } else if (type === "new_connection") {
        log("偵測到新分頁連線!", "success");
        updateConnectionCount(parseInt(connectionCountEl.textContent) + 1);
      }
    };

    // 通知其他頁面新連線
    channel.postMessage({ type: "new_connection" });

    workerStatusEl.textContent = "降級模式";
    log("BroadcastChannel 已就緒", "success");

    // 保存 channel 供後續使用
    window.fallbackChannel = channel;
  } catch (error) {
    log("降級模式也失敗，功能受限", "error");
    workerStatusEl.textContent = "功能受限";
  }
}

// 增加計數
function increment() {
  if (port) {
    port.postMessage({ type: "increment" });
    log("本頁面 +1");
  } else if (window.fallbackChannel) {
    // 降級模式
    currentCount++;
    localStorage.setItem("sharedCounter", currentCount);
    updateDisplay(currentCount);
    window.fallbackChannel.postMessage({ type: "update", value: currentCount });
    log(`本頁面 +1: ${currentCount}`);
  } else {
    log("無法操作：Worker 未連接", "error");
  }
}

// 減少計數
function decrement() {
  if (port) {
    port.postMessage({ type: "decrement" });
    log("本頁面 -1");
  } else if (window.fallbackChannel) {
    // 降級模式
    currentCount--;
    localStorage.setItem("sharedCounter", currentCount);
    updateDisplay(currentCount);
    window.fallbackChannel.postMessage({ type: "update", value: currentCount });
    log(`本頁面 -1: ${currentCount}`);
  } else {
    log("無法操作：Worker 未連接", "error");
  }
}

// 重置計數
function reset() {
  if (port) {
    port.postMessage({ type: "reset" });
    log("重置計數器");
  } else if (window.fallbackChannel) {
    // 降級模式
    currentCount = 0;
    localStorage.setItem("sharedCounter", 0);
    updateDisplay(0);
    window.fallbackChannel.postMessage({ type: "update", value: 0 });
    log("重置計數器");
  } else {
    log("無法操作：Worker 未連接", "error");
  }
}

// 開啟新分頁
function openNewTab() {
  window.open(window.location.href, "_blank");
  log("開啟新分頁", "success");
}

// 清除日誌
function clearLog() {
  logEl.innerHTML = "";
  log("日誌已清除");
}

// 綁定事件
incrementBtn.addEventListener("click", increment);
decrementBtn.addEventListener("click", decrement);
resetBtn.addEventListener("click", reset);
newTabBtn.addEventListener("click", openNewTab);
clearLogBtn.addEventListener("click", clearLog);

// 頁面載入時初始化
window.addEventListener("DOMContentLoaded", () => {
  log("SharedWorker Demo 已載入");
  log("💡 提示：開啟多個分頁來體驗多頁同步功能");
  initSharedWorker();
});

// 頁面卸載時清理
window.addEventListener("beforeunload", () => {
  if (port) {
    port.postMessage({ type: "disconnect" });
  }
  if (window.fallbackChannel) {
    window.fallbackChannel.close();
  }
});
