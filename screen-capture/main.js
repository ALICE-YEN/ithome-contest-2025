const els = {
  video: document.getElementById("screenPreview"),
  shareStatus: document.getElementById("shareStatus"),
  recStatus: document.getElementById("recStatus"),
  selFrameRate: document.getElementById("selFrameRate"),
  selCursor: document.getElementById("selCursor"),
  chkMic: document.getElementById("chkMic"),
  btnStartShare: document.getElementById("btnStartShare"),
  btnStopShare: document.getElementById("btnStopShare"),
  btnStartRec: document.getElementById("btnStartRec"),
  btnStopRec: document.getElementById("btnStopRec"),
  recordings: document.getElementById("recordings"),
  log: document.getElementById("log"),
};

let screenStream = null; // getDisplayMedia() 回來的螢幕串流（含畫面、可能含來源音）
let micStream = null; // getUserMedia({audio:true}) 拿到的麥克風串流
let mixedStream = null; // 用 Web Audio 把「來源音＋麥克風」混成單一音軌後，與影片軌合併得到的最終要錄的串流
let audioCtx = null;
let destNode = null;
let recorder = null; // MediaRecorder 實例
let chunks = []; // 暫存錄影片段（最後會組成一個 Blob）

function log(...args) {
  const s = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");
  els.log.textContent += s + "\n";
  els.log.scrollTop = els.log.scrollHeight;
}
function setShare(t) {
  els.shareStatus.textContent = t;
}
function setRec(t) {
  els.recStatus.textContent = t;
}

// 依序嘗試 video/webm;codecs=vp9,opus → vp8,opus → webm → mp4，用 MediaRecorder.isTypeSupported() 偵測可用的輸出格式；找不到就回空字串，代表「交給瀏覽器自己挑」。
function pickMime() {
  if (!(window.MediaRecorder && MediaRecorder.isTypeSupported)) return "";
  const cands = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return cands.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

async function startShare() {
  try {
    // 從右側控制面板讀取目標幀率與游標顯示策略
    const frameRate = Number(els.selFrameRate.value) || 30;
    const cursor = els.selCursor.value;

    // 要求螢幕串流（一定有 video 軌；audio 是否有要看來源/瀏覽器是否允許）
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate, cursor },
      audio: true,
    });

    const [vTrack] = screenStream.getVideoTracks();

    vTrack.addEventListener("ended", () => {
      log("🛑 分享來源已停止");
      if (recorder && recorder.state !== "inactive") stopRec();
      stopShare();
    });

    // 分享的畫面顯示在預覽 <video>；catch 避免偶發自動播放錯誤中斷流程
    els.video.srcObject = screenStream;
    await els.video.play().catch(() => {});

    els.btnStopShare.disabled = false;
    els.btnStartRec.disabled = false;
    setShare("ON");
    log("🖥️ Screen sharing started");
  } catch (e) {
    log("❌ getDisplayMedia 失敗: " + e.name + " " + e.message);
  }
}

function stopTracks(stream) {
  if (!stream) return;

  // 一個串流所有軌都停掉（audio+video）
  stream.getTracks().forEach((t) => t.stop());
}

function stopShare() {
  stopTracks(screenStream);
  screenStream = null;
  stopTracks(micStream);
  micStream = null;
  stopTracks(mixedStream);
  mixedStream = null;

  if (audioCtx) {
    try {
      audioCtx.close();
    } catch (_) {}
    audioCtx = null;
    destNode = null;
  }

  els.video.srcObject = null;
  els.btnStopShare.disabled = true;
  els.btnStartRec.disabled = true;
  setShare("IDLE");
  log("⏹️ Screen share stopped");
}

async function buildMixedStream() {
  // 如果沒勾選「合併麥克風旁白」，就直接用螢幕串流
  if (!els.chkMic.checked) return screenStream;

  // 建立 Web Audio 拓樸的輸出節點，等會兒把多個音源全部接上這個節點，形成一條音軌
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!audioCtx) audioCtx = new AC();
  destNode = audioCtx.createMediaStreamDestination();

  // 若螢幕來源有音（分頁音/系統音），接進來
  const sTrack = screenStream.getAudioTracks()[0];
  if (sTrack) {
    const sSrc = audioCtx.createMediaStreamSource(new MediaStream([sTrack]));
    sSrc.connect(destNode);
  }

  // 取麥克風音，也接進來
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mTrack = micStream.getAudioTracks()[0];
  if (mTrack) {
    const mSrc = audioCtx.createMediaStreamSource(new MediaStream([mTrack]));
    mSrc.connect(destNode);
  }

  // 合成影片＋單一混音的串流，回傳給錄製用（多數瀏覽器的 MediaRecorder 只吃第一條音軌，所以必須先混好）
  return new MediaStream([
    ...screenStream.getVideoTracks(),
    ...destNode.stream.getAudioTracks(),
  ]);
}

// 收集非空的片段。不同瀏覽器可能在 start(timeslice) 期間定時吐、或只在 stop() 時吐最後一包
function onDataAvailable(e) {
  if (e.data && e.data.size) chunks.push(e.data);
}

function onStop() {
  const type =
    recorder.mimeType || (chunks[0] && chunks[0].type) || "video/webm"; // 決定輸出 MIME 型別（優先用 recorder 的設定）
  const blob = new Blob(chunks, { type });
  const url = URL.createObjectURL(blob); // 把 chunks 組成 Blob 檔，並建立臨時 URL

  const wrap = document.createElement("div");
  wrap.className = "rec-item";

  const a = document.createElement("a");
  a.href = url;
  a.download = `screen-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`;
  a.textContent = "Download recording";

  const v = document.createElement("video");
  v.controls = true;
  v.src = url;

  wrap.appendChild(a);
  wrap.appendChild(v);
  if (els.recordings) els.recordings.prepend(wrap);

  // 60 秒後回收臨時 URL，避免記憶體佔用（保守作法，給使用者一些時間點下載/播放）
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  setRec("STOPPED");
  els.btnStartRec.disabled = !screenStream;
  els.btnStopRec.disabled = true;
}

async function startRec() {
  if (!screenStream) {
    log("⚠️ 尚未開始分享螢幕");
    return;
  }
  chunks = [];

  const mime = pickMime();
  mixedStream = await buildMixedStream();
  const input = mixedStream || screenStream;

  // 建立 MediaRecorder。如果指定的 mimeType 不支援會丟 NotSupportedError（上層 try/catch 有處理）
  try {
    recorder = mime
      ? new MediaRecorder(input, { mimeType: mime })
      : new MediaRecorder(input);
  } catch (e) {
    log("❌ 建立 MediaRecorder 失敗: " + e.name + " " + e.message);
    return;
  }

  recorder.ondataavailable = onDataAvailable;
  recorder.onstop = onStop;

  try {
    recorder.start(1000); // 優先每秒吐一塊（利於長錄影與邊錄邊傳）；如果瀏覽器不支援 timeslice 用法，就退回連續錄到 stop()。
  } catch {
    recorder.start();
  }

  setRec("RECORDING");
  els.btnStartRec.disabled = true;
  els.btnStopRec.disabled = false;
  log("⏺️ Recording started");
}

function stopRec() {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
    log("⏹️ Recording stopping...");
  }
}

function bindUI() {
  els.btnStartShare.addEventListener("click", startShare);
  els.btnStopShare.addEventListener("click", stopShare);
  els.btnStartRec.addEventListener("click", startRec);
  els.btnStopRec.addEventListener("click", stopRec);
}

function init() {
  bindUI();
  log("提示：請在 HTTPS 或 http://localhost 下測試。");
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
