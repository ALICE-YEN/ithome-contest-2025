// MediaDevices Demo：相機 / 麥克風 / 錄音 / 螢幕分享 / 裝置切換 / 自拍鏡像
const els = {
  video: document.getElementById("videoPreview"),
  screen: document.getElementById("screenPreview"),
  camStatus: document.getElementById("camStatus"),
  micStatus: document.getElementById("micStatus"),
  recStatus: document.getElementById("recStatus"),
  camSel: document.getElementById("cameraSelect"),
  micSel: document.getElementById("micSelect"),
  btnFacingUser: document.getElementById("btnFacingUser"),
  btnFacingEnv: document.getElementById("btnFacingEnv"),
  btnStartCam: document.getElementById("btnStartCam"),
  btnStopCam: document.getElementById("btnStopCam"),
  btnMuteCam: document.getElementById("btnMuteCam"),
  btnMirror: document.getElementById("btnMirror"),
  btnStartShare: document.getElementById("btnStartShare"),
  btnStopShare: document.getElementById("btnStopShare"),
  btnStartRec: document.getElementById("btnStartRec"),
  btnStopRec: document.getElementById("btnStopRec"),
  recordings: document.getElementById("recordings"),
  log: document.getElementById("log"),
};

let camStream = null;
let screenStream = null;
let audioRecorder = null;
let recordedChunks = [];
let mirrored = false;

function log(...args) {
  const s = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");
  els.log.textContent += s + "\n";
  els.log.scrollTop = els.log.scrollHeight;
  console.log(...args);
}

function setCamStatus(t) {
  els.camStatus.textContent = t;
}
function setMicStatus(t) {
  els.micStatus.textContent = t;
}
function setRecStatus(t) {
  els.recStatus.textContent = t;
}

async function enumerate() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    const mics = devices.filter((d) => d.kind === "audioinput");

    els.camSel.innerHTML = cams
      .map(
        (d) => `<option value="${d.deviceId}">${d.label || "Camera"}</option>`
      )
      .join("");
    els.micSel.innerHTML = mics
      .map(
        (d) =>
          `<option value="${d.deviceId}">${d.label || "Microphone"}</option>`
      )
      .join("");

    if (!cams.length) log("⚠️ 找不到視訊裝置");
    if (!mics.length) log("⚠️ 找不到音訊裝置");
  } catch (e) {
    log("enumerateDevices 錯誤:", e.name, e.message);
  }
}

function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

function applyMirror() {
  mirrored = !mirrored;
  els.video.style.transform = mirrored ? "scaleX(-1)" : "none";
  els.btnMirror.textContent = mirrored ? "Unmirror" : "Mirror";
}

async function startCamera({ deviceId, micId, facingMode } = {}) {
  try {
    stopStream(camStream);

    const video = facingMode
      ? facingMode // 'user' 或 { exact: 'environment' }
      : deviceId
      ? { deviceId: { exact: deviceId } }
      : true;
    const audio = micId ? { deviceId: { exact: micId } } : true;

    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    camStream = stream;
    els.video.srcObject = stream;

    els.btnStopCam.disabled = false;
    els.btnMuteCam.disabled = false;
    els.btnMirror.disabled = false;
    els.btnStartRec.disabled = false;
    setCamStatus("ON");

    const audioTrack = stream.getAudioTracks()[0];
    setMicStatus(audioTrack ? (audioTrack.enabled ? "ON" : "MUTED") : "N/A");

    await enumerate(); // 取得權限後會帶出裝置 label
    log("✅ Camera started");
  } catch (e) {
    setCamStatus("ERROR");
    log("❌ startCamera 錯誤:", e.name, e.message);
  }
}

function stopCamera() {
  stopStream(camStream);
  camStream = null;
  els.video.srcObject = null;
  els.btnStopCam.disabled = true;
  els.btnMuteCam.disabled = true;
  els.btnMirror.disabled = true;
  els.btnStartRec.disabled = true;
  setCamStatus("IDLE");
  setMicStatus("IDLE");
  log("⏹️ Camera stopped");
}

function toggleMute() {
  if (!camStream) return;
  camStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
  const anyEnabled = camStream.getAudioTracks().some((t) => t.enabled);
  els.btnMuteCam.textContent = anyEnabled ? "Mute" : "Unmute";
  setMicStatus(anyEnabled ? "ON" : "MUTED");
}

async function startShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    els.screen.srcObject = screenStream;
    els.btnStopShare.disabled = false;
    log("🖥️ Screen sharing started");
  } catch (e) {
    log("❌ getDisplayMedia 錯誤:", e.name, e.message);
  }
}

function stopShare() {
  stopStream(screenStream);
  screenStream = null;
  els.screen.srcObject = null;
  els.btnStopShare.disabled = true;
  log("⏹️ Screen share stopped");
}

function chooseMime() {
  // Safari 對 webm 支援度較差，嘗試 fallback
  if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
    if (MediaRecorder.isTypeSupported("audio/webm"))
      return { mimeType: "audio/webm" };
    if (MediaRecorder.isTypeSupported("audio/mp4"))
      return { mimeType: "audio/mp4" };
  }
  return {}; // 交由瀏覽器決定
}

function startRecording() {
  if (!camStream) {
    log("⚠️ 尚未開啟攝影機/麥克風");
    return;
  }
  try {
    recordedChunks = [];
    audioRecorder = new MediaRecorder(camStream, chooseMime());
    audioRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    audioRecorder.onstop = () => {
      const type = recordedChunks[0]?.type || "audio/webm";
      const blob = new Blob(recordedChunks, { type });
      const url = URL.createObjectURL(blob);
      const item = document.createElement("div");
      item.className = "rec-item";
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${Date.now()}.${
        type.includes("mp4") ? "mp4" : "webm"
      }`;
      a.textContent = "Download recording";
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = url;
      item.appendChild(a);
      item.appendChild(audio);
      els.recordings.prepend(item);
      setRecStatus("STOPPED");
    };
    audioRecorder.start();
    setRecStatus("RECORDING");
    els.btnStopRec.disabled = false;
    els.btnStartRec.disabled = true;
    log("⏺️ Start recording");
  } catch (e) {
    log("❌ MediaRecorder 錯誤:", e.name, e.message);
  }
}

function stopRecording() {
  if (audioRecorder && audioRecorder.state !== "inactive") {
    audioRecorder.stop();
    els.btnStopRec.disabled = true;
    els.btnStartRec.disabled = false;
    log("⏹️ Stop recording");
  }
}

function bindUI() {
  els.btnStartCam.addEventListener("click", () =>
    startCamera({
      deviceId: els.camSel.value || undefined,
      micId: els.micSel.value || undefined,
    })
  );
  els.btnStopCam.addEventListener("click", stopCamera);
  els.btnMuteCam.addEventListener("click", toggleMute);
  els.btnMirror.addEventListener("click", applyMirror);

  els.btnFacingUser.addEventListener("click", () =>
    startCamera({ facingMode: "user" })
  );
  els.btnFacingEnv.addEventListener("click", () =>
    startCamera({ facingMode: { exact: "environment" } })
  );

  els.btnStartShare.addEventListener("click", startShare);
  els.btnStopShare.addEventListener("click", stopShare);

  els.btnStartRec.addEventListener("click", startRecording);
  els.btnStopRec.addEventListener("click", stopRecording);

  els.camSel.addEventListener("change", () =>
    startCamera({ deviceId: els.camSel.value })
  );
  els.micSel.addEventListener("change", () =>
    startCamera({ deviceId: els.camSel.value, micId: els.micSel.value })
  );
}

async function init() {
  bindUI();
  await enumerate();
  log("提示：請在 HTTPS 或 http://localhost 之下執行");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
