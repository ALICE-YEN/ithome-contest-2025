/**
 * Day 12 Demo — Fullscreen / Clipboard / Web Share
 * 與 screen-capture 的主結構一致：左側 Sidebar、中央舞台、右側控制面板。
 * - Fullscreen：對 #fsTarget 進入/退出
 * - Clipboard：寫入/讀取文字、paste 事件
 * - Web Share：分享頁面 / 分享 Canvas PNG / 分享使用者選取檔案
 */

const els = {
  fsTarget: document.getElementById("fsTarget"),
  paint: document.getElementById("paint"),
  fsStatus: document.getElementById("fsStatus"),
  cbStatus: document.getElementById("cbStatus"),
  shareStatus: document.getElementById("shareStatus"),
  btnToggleFS: document.getElementById("btnToggleFS"),
  btnExitFS: document.getElementById("btnExitFS"),
  copyInput: document.getElementById("copyInput"),
  btnCopy: document.getElementById("btnCopy"),
  btnRead: document.getElementById("btnRead"),
  pasteHere: document.getElementById("pasteHere"),
  btnShare: document.getElementById("btnShare"),
  btnShareCanvas: document.getElementById("btnShareCanvas"),
  filePicker: document.getElementById("filePicker"),
  btnShareFiles: document.getElementById("btnShareFiles"),
  log: document.getElementById("log"),
};

function log(...args) {
  const s = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");
  els.log.textContent += s + "\n";
  els.log.scrollTop = els.log.scrollHeight;
}

// ---------- Fullscreen ----------
function setFSStatus(t) {
  els.fsStatus.textContent = t;
}

async function enterFS() {
  try {
    if (!document.fullscreenElement) {
      await els.fsTarget.requestFullscreen();
    }
  } catch (e) {
    log("❌ requestFullscreen 失敗:", e.name, e.message);
  }
}
async function exitFS() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch (e) {
    log("❌ exitFullscreen 失敗:", e.name, e.message);
  }
}

document.addEventListener("fullscreenchange", () => {
  const inFS = !!document.fullscreenElement;
  setFSStatus(inFS ? "ON" : "IDLE");
  els.btnToggleFS.textContent = inFS ? "Entered" : "Enter Fullscreen";
  els.btnExitFS.disabled = !inFS;
});

// ---------- Clipboard ----------
function setCBStatus(t) {
  els.cbStatus.textContent = t;
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    setCBStatus("COPIED");
    log("📋 Copied:", t);
  } catch {
    // 最小備援
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-9999px;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      setCBStatus("COPIED*");
    } catch (e) {
      setCBStatus("FAIL");
      log("❌ execCommand(copy) 失敗");
    } finally {
      ta.remove();
    }
  }
}

async function readText() {
  try {
    const t = await navigator.clipboard.readText();
    setCBStatus("READ");
    log("📥 Read:", t || "(empty)");
  } catch (e) {
    setCBStatus("DENIED");
    log("⚠️ 無法讀取（需要權限/HTTPS 或不支援）");
  }
}

// 使用者主動貼上（最穩）
els.pasteHere.addEventListener("paste", (e) => {
  const t = e.clipboardData?.getData("text") ?? "";
  log("PASTE event:", t);
});

// ---------- Web Share ----------
function setShareStatus(t) {
  els.shareStatus.textContent = t;
}

async function sharePage() {
  const url = location.href;
  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("COPIED LINK");
    } catch {
      prompt("請手動複製以下連結", url);
    }
    return;
  }
  try {
    await navigator.share({ title: document.title, text: "看看這頁", url });
    setShareStatus("SHARED");
  } catch (e) {
    if (e?.name !== "AbortError") {
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus("COPIED LINK");
      } catch {
        prompt("請手動複製以下連結", url);
      }
    }
  }
}

function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve) => canvas.toBlob(resolve, type));
}

async function shareCanvas() {
  const blob = await canvasToBlob(els.paint, "image/png");
  const file = new File([blob], "screenshot.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Canvas Screenshot" });
      setShareStatus("SHARED FILE");
    } catch (e) {
      /* 取消不視為錯誤 */
    }
  } else {
    // 不支援 → 提供下載
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "screenshot.png";
    a.click();
    URL.revokeObjectURL(a.href);
    setShareStatus("DOWNLOADED");
  }
}

async function shareFiles() {
  const files = Array.from(els.filePicker.files || []);
  if (!files.length) {
    alert("請先選檔");
    return;
  }
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: "檔案分享" });
      setShareStatus("SHARED FILES");
    } catch (e) {
      /* 取消 */
    }
  } else {
    alert("此裝置/瀏覽器暫不支援分享檔案");
  }
}

// ---------- 舞台：畫點東西在 Canvas 上 ----------
function drawCanvas() {
  const c = els.paint,
    ctx = c.getContext("2d");
  // 背景
  const grd = ctx.createLinearGradient(0, 0, c.width, c.height);
  grd.addColorStop(0, "#00d2ff");
  grd.addColorStop(1, "#3a7bd5");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, c.width, c.height);

  // 中央字樣
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 36px ui-sans-serif, system-ui, -apple-system";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Day 12 Demo", c.width / 2, c.height / 2 - 8);
  ctx.font = "16px ui-sans-serif, system-ui, -apple-system";
  ctx.fillText("Canvas → Copy / Share", c.width / 2, c.height / 2 + 24);
}

// ---------- 綁事件 / 初始化 ----------
function bindUI() {
  els.btnToggleFS.addEventListener("click", enterFS);
  els.btnExitFS.addEventListener("click", exitFS);
  els.btnCopy.addEventListener("click", () => copyText(els.copyInput.value));
  els.btnRead.addEventListener("click", readText);
  els.btnShare.addEventListener("click", sharePage);
  els.btnShareCanvas.addEventListener("click", shareCanvas);
  els.btnShareFiles.addEventListener("click", shareFiles);
}

function init() {
  bindUI();
  drawCanvas();
  log("提示：請在 HTTPS 或 http://localhost 測試。");
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
