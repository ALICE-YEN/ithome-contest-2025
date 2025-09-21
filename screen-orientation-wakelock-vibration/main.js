// DOM 選取器簡化
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 元素快取
const els = {
  // 狀態顯示
  oriStatus: $("#oriStatus"),
  wkStatus: $("#wkStatus"),
  vbStatus: $("#vbStatus"),

  // 支援度顯示
  orientationSupport: $("#orientationSupport"),
  wakelockSupport: $("#wakelockSupport"),
  vibrationSupport: $("#vibrationSupport"),

  // 按鈕
  btnLockLandscape: $("#btnLockLandscape"),
  btnLockPortrait: $("#btnLockPortrait"),
  btnUnlockOri: $("#btnUnlockOri"),
  btnCSSLandscape: $("#btnCSSLandscape"),
  btnCSSPortrait: $("#btnCSSPortrait"),
  btnCSSAuto: $("#btnCSSAuto"),

  btnWKOn: $("#btnWKOn"),
  btnWKOff: $("#btnWKOff"),

  btnTap: $("#btnTap"),
  btnSuccess: $("#btnSuccess"),
  btnStop: $("#btnStop"),

  // 記錄
  log: $("#log"),
};

// ===== 工具函數 =====
function logMessage(msg, type = "info") {
  if (!els.log) return;

  const div = document.createElement("div");
  div.className = `log-line ${type}`;
  div.textContent = msg;
  els.log.appendChild(div);
  els.log.scrollTop = els.log.scrollHeight; // 隨著訊息增加，自動滾動到底部

  // 限制記錄數量
  if (els.log.children.length > 100) {
    els.log.removeChild(els.log.firstChild);
  }
}

function detectDevice() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile = /Mobi|Android/i.test(ua);
  const isDesktop = !isMobile;

  return { isIOS, isAndroid, isMobile, isDesktop, ua };
}

// ===== Screen Orientation =====
let cssOrientationMode = null; // 'landscape' | 'portrait' | null

function updateOrientationStatus() {
  try {
    let type = "unknown";
    let angle = 0;

    // 優先使用 Screen Orientation API
    if (screen.orientation) {
      type = screen.orientation.type || "unknown";
      angle = screen.orientation.angle || 0;
    } else {
      // 降級使用 CSS Media Query
      const isPortrait = matchMedia("(orientation: portrait)").matches; // 使用了 CSS 的 Media Query（媒體查詢）API，去偵測目前瀏覽器視窗（viewport）是不是"直立"（portrait）模式
      type = isPortrait ? "portrait" : "landscape"; // 如果是直立，就是 portrait，否則就是 landscape
      angle = window.orientation || 0;
    }

    // 如果有 CSS 模擬模式，顯示模擬狀態
    if (cssOrientationMode) {
      type = `CSS-${cssOrientationMode}`;
    }

    els.oriStatus.textContent = `${type} (${angle}°)`;
  } catch (error) {
    els.oriStatus.textContent = "Error";
    logMessage(`方向檢測錯誤: ${error.message}`, "error");
  }
}

function checkOrientationSupport() {
  const device = detectDevice();

  // 檢查 Screen Orientation API 支援
  const hasOrientationAPI = "orientation" in screen;
  const hasLockFunction = typeof screen.orientation?.lock === "function";

  logMessage(
    `裝置資訊: ${
      device.isIOS ? "iOS" : device.isAndroid ? "Android" : "Desktop"
    }`
  );

  // 更新支援狀態顯示
  if (hasLockFunction && device.isAndroid) {
    els.orientationSupport.textContent = "✅ 完整支援";
    els.orientationSupport.className = "support-status support-yes";
  } else if (hasOrientationAPI) {
    els.orientationSupport.textContent = "⚠️ 部分支援（僅偵測）";
    els.orientationSupport.className = "support-status support-partial";
    logMessage("此裝置僅支援『方向偵測』，不支援『螢幕鎖定方向』。", "warning");
    if (device.isIOS) {
      logMessage("iOS/Safari 目前不支援 ScreenOrientation.lock()。", "warning");
    }
  } else {
    els.orientationSupport.textContent = "❌ 不支援 API（CSS 降級）";
    els.orientationSupport.className = "support-status support-no";
  }

  // 禁用不支援的按鈕（交由 CSS :disabled 呈現樣式）
  if (!hasOrientationAPI || !hasLockFunction) {
    // if (!hasOrientationAPI || !hasLockFunction || !device.isAndroid) {
    [els.btnLockLandscape, els.btnLockPortrait, els.btnUnlockOri].forEach(
      (btn) => {
        if (btn) btn.disabled = true;
      }
    );
    if (!hasOrientationAPI) {
      logMessage(
        "Screen Orientation API 不存在，API 螢幕鎖定方向按鈕已禁用",
        "warning"
      );
    } else if (!hasLockFunction) {
      logMessage(
        "螢幕鎖定方向功能不支援，API 螢幕鎖定方向按鈕已禁用",
        "warning"
      );
    }
    logMessage("請使用『CSS 橫向／CSS 直向』按鈕模擬觀察版面。");
  }

  return { hasOrientationAPI, hasLockFunction };
}

// API 螢幕鎖定方向功能
async function lockOrientation(orientation) {
  try {
    if (!screen.orientation?.lock) {
      throw new Error("螢幕鎖定方向 API 不支援");
    }

    await screen.orientation.lock(orientation);
    logMessage(`✅ API 螢幕鎖定方向成功: ${orientation}`, "success");
  } catch (error) {
    const device = detectDevice();
    const errorMsg =
      error.name === "NotSupportedError"
        ? device.isIOS
          ? "此裝置（iOS/Safari）不支援螢幕鎖定方向，但可偵測方向"
          : "此裝置不支援螢幕鎖定方向（但可偵測方向）"
        : error.name === "SecurityError"
        ? "安全限制：需要全螢幕模式"
        : error.name === "InvalidStateError"
        ? "無效狀態：可能需要全螢幕"
        : error.message || "螢幕鎖定方向失敗";

    logMessage(`❌ API 螢幕鎖定方向失敗: ${errorMsg}`, "error");
  }
}

function unlockOrientation() {
  try {
    if (screen.orientation?.unlock) {
      screen.orientation.unlock();
      logMessage("✅ API 解除螢幕鎖定方向", "success");
    } else {
      logMessage("❌ 解除螢幕鎖定方向 API 不支援", "warning");
    }
  } catch (error) {
    logMessage(`❌ 解除螢幕鎖定方向失敗: ${error.message}`, "error");
  }
}

// CSS 模擬螢幕鎖定方向
function applyCSSOrientation(mode) {
  cssOrientationMode = mode;

  // 移除之前的 CSS
  const oldStyle = $("#css-orientation-override");
  if (oldStyle) oldStyle.remove();

  if (mode) {
    const style = document.createElement("style");
    style.id = "css-orientation-override";

    if (mode === "landscape") {
      style.textContent = `
        .stage { aspect-ratio: 16/9 !important; }
        .portrait-only { display: none !important; }
        .landscape-only { display: block !important; }
        .css-fallback-demo .fallback-status::after {
          content: "🔒 CSS 強制橫向模式";
          display: block;
          color: #10b981;
          font-weight: bold;
          margin-top: 8px;
        }
      `;
    } else if (mode === "portrait") {
      style.textContent = `
        .stage { aspect-ratio: 9/16 !important; }
        .portrait-only { display: block !important; }
        .landscape-only { display: none !important; }
        .css-fallback-demo .fallback-status::after {
          content: "🔒 CSS 強制直向模式";
          display: block;
          color: #10b981;
          font-weight: bold;
          margin-top: 8px;
        }
      `;
    }

    document.head.appendChild(style);
    logMessage(`✅ CSS 模擬 ${mode} 模式`, "success");
  } else {
    logMessage("✅ 取消 CSS 模擬，恢復自動偵測", "success");
  }

  updateOrientationStatus();
}

// ===== Wake Lock =====
let wakeLock = null;
let wakeLockRequested = false;

function checkWakeLockSupport() {
  const hasWakeLock = "wakeLock" in navigator;
  const isSecure =
    location.protocol === "https:" || location.hostname === "localhost";

  logMessage(`Wake Lock API: ${hasWakeLock ? "✅ 有" : "❌ 無"}`);
  logMessage(`安全環境 (HTTPS): ${isSecure ? "✅ 是" : "❌ 否"}`);

  if (hasWakeLock && isSecure) {
    els.wakelockSupport.textContent = "✅ 完整支援";
    els.wakelockSupport.className = "support-status support-yes";
  } else if (hasWakeLock && !isSecure) {
    els.wakelockSupport.textContent = "⚠️ 需要 HTTPS";
    els.wakelockSupport.className = "support-status support-partial";
  } else {
    els.wakelockSupport.textContent = "❌ 不支援";
    els.wakelockSupport.className = "support-status support-no";
    [els.btnWKOn, els.btnWKOff].forEach((btn) => {
      if (btn) btn.disabled = true; // 視覺交給 CSS
    });
  }

  return hasWakeLock && isSecure;
}

async function requestWakeLock() {
  wakeLockRequested = true;

  try {
    if (!navigator.wakeLock) {
      throw new Error("Wake Lock API 不支援");
    }

    wakeLock = await navigator.wakeLock.request("screen");

    // 主要監聽
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
      els.wkStatus.textContent = "OFF";
      logMessage("⚠️ Wake Lock 被系統釋放", "warning");
    });
    // 後援（部分瀏覽器用 onrelease）
    if (!("onrelease" in wakeLock)) {
      // noop; 已有 addEventListener
    } else {
      wakeLock.onrelease = () => {
        wakeLock = null;
        els.wkStatus.textContent = "OFF";
        logMessage("⚠️ Wake Lock 釋放（onrelease）", "warning");
      };
    }

    els.wkStatus.textContent = "ON";
    logMessage("✅ 螢幕保持常亮", "success");
  } catch (error) {
    const errorMsg =
      error.name === "NotAllowedError"
        ? "需要使用者手勢觸發"
        : error.name === "SecurityError"
        ? "安全限制"
        : error.name === "AbortError"
        ? "請求被中止"
        : error.message || "未知錯誤";

    logMessage(`❌ Wake Lock 失敗: ${errorMsg}`, "error");
    wakeLockRequested = false;
  }
}

async function releaseWakeLock() {
  wakeLockRequested = false;

  try {
    if (wakeLock) {
      await wakeLock.release();
    }
  } finally {
    wakeLock = null;
    els.wkStatus.textContent = "OFF";
    logMessage("✅ 釋放 Wake Lock", "success");
  }
}

// 頁面可見性變化時重新申請 Wake Lock
document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    wakeLockRequested &&
    !wakeLock
  ) {
    logMessage("📱 頁面重新可見，嘗試重新申請 Wake Lock");
    requestWakeLock();
  }
});

// ===== Vibration =====
function checkVibrationSupport() {
  const hasVibration = "vibrate" in navigator;
  const device = detectDevice();

  logMessage(`Vibration API: ${hasVibration ? "✅ 有" : "❌ 無"}`);

  if (hasVibration) {
    if (device.isAndroid) {
      els.vibrationSupport.textContent = "✅ 完整支援";
      els.vibrationSupport.className = "support-status support-yes";
    } else {
      els.vibrationSupport.textContent = "⚠️ API 存在但可能無效";
      els.vibrationSupport.className = "support-status support-partial";
    }
  } else {
    els.vibrationSupport.textContent = "❌ 不支援";
    els.vibrationSupport.className = "support-status support-no";
  }

  return hasVibration;
}

function vibrate(pattern, name) {
  try {
    if (!navigator.vibrate) {
      logMessage("❌ Vibration API 不存在", "error");
      els.vbStatus.textContent = "NOT SUPPORT";
      return false;
    }

    const success = navigator.vibrate(pattern);

    if (success) {
      els.vbStatus.textContent = name.toUpperCase();
      logMessage(
        `📳 震動執行: ${name} (${JSON.stringify(pattern)})`,
        "success"
      );
    } else {
      logMessage(`⚠️ 震動可能被拒絕: ${name}`, "warning");
      els.vbStatus.textContent = "BLOCKED?";
    }

    return success;
  } catch (error) {
    logMessage(`❌ 震動錯誤: ${error.message}`, "error");
    els.vbStatus.textContent = "ERROR";
    return false;
  }
}

function stopVibration() {
  vibrate(0, "stop");
  els.vbStatus.textContent = "STOP";
}

// ===== 事件監聽 =====
function bindEvents() {
  // Screen Orientation 事件
  if (screen.orientation) {
    screen.orientation.addEventListener("change", () => {
      updateOrientationStatus();
      logMessage(
        `方向變更: ${screen.orientation.type} @ ${screen.orientation.angle}°`
      );
    });
  }

  // 降級：window orientationchange 事件
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      updateOrientationStatus();
      logMessage(
        `視窗方向變更 (orientation: ${window.orientation || "unknown"})`
      );
    }, 100);
  });

  // CSS Media Query 變化監聽（非模擬狀態才更新）
  const portraitMatch = matchMedia("(orientation: portrait)");
  const landscapeMatch = matchMedia("(orientation: landscape)");

  portraitMatch.addEventListener("change", (e) => {
    if (e.matches && !cssOrientationMode) {
      logMessage("CSS 偵測到切換為直向");
      updateOrientationStatus();
    }
  });

  landscapeMatch.addEventListener("change", (e) => {
    if (e.matches && !cssOrientationMode) {
      logMessage("CSS 偵測到切換為橫向");
      updateOrientationStatus();
    }
  });

  // 按鈕事件
  els.btnLockLandscape?.addEventListener("click", () =>
    lockOrientation("landscape")
  );
  els.btnLockPortrait?.addEventListener("click", () =>
    lockOrientation("portrait")
  );
  els.btnUnlockOri?.addEventListener("click", unlockOrientation);

  els.btnCSSLandscape?.addEventListener("click", () =>
    applyCSSOrientation("landscape")
  );
  els.btnCSSPortrait?.addEventListener("click", () =>
    applyCSSOrientation("portrait")
  );
  els.btnCSSAuto?.addEventListener("click", () => applyCSSOrientation(null));

  els.btnWKOn?.addEventListener("click", requestWakeLock);
  els.btnWKOff?.addEventListener("click", releaseWakeLock);

  els.btnTap?.addEventListener("click", () => vibrate(30, "tap"));
  els.btnSuccess?.addEventListener("click", () =>
    vibrate([40, 40, 80], "success")
  );
  els.btnStop?.addEventListener("click", stopVibration);
}

// ===== 初始化 =====
function init() {
  logMessage("=== 裝置支援度檢測開始 ===");

  // 檢測裝置資訊
  const device = detectDevice();
  logMessage(`User Agent: ${device.ua}`);

  // 檢測各 API 支援度
  checkOrientationSupport();
  checkWakeLockSupport();
  checkVibrationSupport();

  // 綁定事件
  bindEvents();

  // 初始狀態更新
  updateOrientationStatus();

  logMessage("=== 初始化完成 ===", "success");
}

// DOM 準備就緒後執行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
