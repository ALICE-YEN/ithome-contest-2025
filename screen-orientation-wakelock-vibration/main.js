const els = {
  oriStatus: document.getElementById("oriStatus"),
  wkStatus: document.getElementById("wkStatus"),
  vbStatus: document.getElementById("vbStatus"),
  btnLockLandscape: document.getElementById("btnLockLandscape"),
  btnLockPortrait: document.getElementById("btnLockPortrait"),
  btnUnlockOri: document.getElementById("btnUnlockOri"),
  btnWKOn: document.getElementById("btnWKOn"),
  btnWKOff: document.getElementById("btnWKOff"),
  btnTap: document.getElementById("btnTap"),
  btnOk: document.getElementById("btnOk"),
  btnStop: document.getElementById("btnStop"),
};

// -------- Orientation --------
function getOrientationFallback() {
  const isPortrait = matchMedia("(orientation: portrait)").matches;
  return {
    type: isPortrait ? "portrait-primary" : "landscape-primary",
    angle: 0,
  };
}

function updateOrientationStatus() {
  const o = screen.orientation;
  const type = o?.type ?? getOrientationFallback().type;
  const angle = Number.isFinite(o?.angle)
    ? o.angle
    : getOrientationFallback().angle;
  els.oriStatus.textContent = `${type} @ ${angle}°`;
}

async function lockLandscape() {
  try {
    await screen.orientation?.lock?.("landscape");
  } catch (_) {}
}
async function lockPortrait() {
  try {
    await screen.orientation?.lock?.("portrait");
  } catch (_) {}
}
function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch (_) {}
}

screen.orientation?.addEventListener?.("change", updateOrientationStatus);
window.addEventListener("orientationchange", updateOrientationStatus);

// -------- Wake Lock --------
let wakeLock = null;
let keepAwakeRequested = false;

async function requestWakeLock() {
  keepAwakeRequested = true;
  try {
    wakeLock = await navigator.wakeLock?.request?.("screen");
    wakeLock?.addEventListener("release", () => {
      wakeLock = null;
      els.wkStatus.textContent = "OFF";
    });
    els.wkStatus.textContent = "ON";
  } catch (_) {}
}

async function releaseWakeLock() {
  keepAwakeRequested = false;
  try {
    await wakeLock?.release?.();
  } finally {
    wakeLock = null;
    els.wkStatus.textContent = "OFF";
  }
}

document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    keepAwakeRequested &&
    !wakeLock
  ) {
    requestWakeLock();
  }
});

// -------- Vibration --------
const V = (p) => navigator.vibrate?.(p) ?? false;

function vibrateTap() {
  if (V(30)) els.vbStatus.textContent = "TAP";
}
function vibrateOk() {
  if (V([40, 40, 80])) els.vbStatus.textContent = "OK";
}
function vibrateStop() {
  V(0);
  els.vbStatus.textContent = "STOP";
}

// -------- Bind & Init --------
function bindUI() {
  els.btnLockLandscape?.addEventListener("click", lockLandscape);
  els.btnLockPortrait?.addEventListener("click", lockPortrait);
  els.btnUnlockOri?.addEventListener("click", unlockOrientation);

  els.btnWKOn?.addEventListener("click", requestWakeLock);
  els.btnWKOff?.addEventListener("click", releaseWakeLock);

  els.btnTap?.addEventListener("click", vibrateTap);
  els.btnOk?.addEventListener("click", vibrateOk);
  els.btnStop?.addEventListener("click", vibrateStop);
}

function init() {
  bindUI();
  updateOrientationStatus();
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
