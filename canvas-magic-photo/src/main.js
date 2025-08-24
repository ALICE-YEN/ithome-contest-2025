/* =========================================================
 * Canvas Magic Photo — Stars & Snow + Optional Photo
 * - Stars：星空在照片後面
 * - Snow：80% 雪花在後、20% 在前，帶景深
 * ======================================================= */

// 自訂的 $ 小工具在抓 DOM
const $ = (sel) => document.querySelector(sel);

const canvas = $("#canvas");
const ctx = canvas.getContext("2d");
const statusEl = $("#status");

// 高 DPI 處理：實體像素 = CSS * dpr
function setupHiDPI() {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return { dpr, cssW, cssH };
}

let view = { dpr: 1, cssW: canvas.clientWidth, cssH: canvas.clientHeight };
let mode = "stars"; // 'stars' | 'snow'
let time = 0;

// 可選圖片
const photo = { img: null, iw: 0, ih: 0, rect: { x: 0, y: 0, w: 0, h: 0 } };

// 離屏 sprite
let starSprite, snowSprite;
// 粒子
let stars = [];
let flakes = [];

// ---------- Utils ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function setStatus(t, ms = 1600) {
  if (!statusEl) return;
  statusEl.textContent = t;
  statusEl.style.opacity = 1;
  if (ms) setTimeout(() => (statusEl.style.opacity = 0), ms);
}

// ---------- Sprites ----------
// 先離線畫好一張小小的貼圖（sprite），之後用 ctx.drawImage(...) 直接貼到主畫布，省得每一幀都重畫漸層。概念來自遊戲開發的 sprite 素材快取
function makeStarSprite(size = 64) {
  // 做一個離屏小畫布（不加到 DOM），大小是 size × size
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.7)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeSnowSprite(size = 48) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.7)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

// ---------- Build fields ----------
function buildStars() {
  const area = view.cssW * view.cssH;
  const count = clamp(Math.round(area / 1800), 150, 900); // 畫布越大星星越多，但不會少於 150 或多於 900（避免過 sparse 或爆量卡頓）
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * view.cssW,
    y: Math.random() * view.cssH,
    size: rand(0.6, 2.2),
    baseA: rand(0.35, 0.9), // 基礎亮度
    twAmp: rand(0.15, 0.55), // 閃爍幅度
    twSpd: rand(0.6, 1.6), // 閃爍速度
    phase: Math.random() * Math.PI * 2, // 位移相位
  }));
}

function buildSnow() {
  const area = view.cssW * view.cssH;
  const count = clamp(Math.round(area / 4500), 120, 500);
  flakes = Array.from({ length: count }, () => ({
    x: Math.random() * view.cssW,
    y: Math.random() * view.cssH,
    size: rand(1.2, 3.2),
    vy: rand(18, 55) / 60, // 往下落的速度（px/幀）
    driftAmp: rand(0.2, 1.4), // 水平擺動幅度（越大左右晃越明顯）
    driftSpd: rand(0.6, 1.6), // 擺動速度（相位每秒增加量）
    phase: Math.random() * Math.PI * 2, // 水平擺動用的相位
    a: rand(0.65, 1), // 基礎透明度
  }));
}

// ---------- Photo fit (contain) ----------
// 把照片用 「等比縮放、完整顯示（contain）」 的方式擺進畫布中央，四周留白 pad 像素
function fitPhotoContain(pad = 24) {
  if (!photo.img) return;
  const vw = view.cssW - pad * 2;
  const vh = view.cssH - pad * 2;
  const s = Math.min(vw / photo.iw, vh / photo.ih);
  const w = photo.iw * s;
  const h = photo.ih * s;
  const x = (view.cssW - w) / 2;
  const y = (view.cssH - h) / 2;
  photo.rect = { x, y, w, h };
}

// ---------- Init / Resize ----------
function init() {
  view = setupHiDPI();
  starSprite = makeStarSprite(64 * view.dpr);
  snowSprite = makeSnowSprite(48 * view.dpr);
  buildStars();
  buildSnow();

  // Panel wiring
  const modeSel = $("#mode");
  if (modeSel) {
    modeSel.value = mode;
    modeSel.addEventListener("change", (e) => {
      mode = e.target.value;
      setStatus(`Mode: ${mode}`);
    });
  }
  $("#fileInput")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  });
  $("#resetBtn")?.addEventListener("click", clearPhoto);
  $("#exportBtn")?.addEventListener("click", exportPNG);

  // 也可點畫布上傳
  canvas.addEventListener("click", () => $("#fileInput")?.click());

  requestAnimationFrame(tick);
  setStatus("Ready.");
}

window.addEventListener("resize", () => {
  view = setupHiDPI();
  starSprite = makeStarSprite(64 * view.dpr);
  snowSprite = makeSnowSprite(48 * view.dpr);
  buildStars();
  buildSnow();
  fitPhotoContain();
});

// ---------- File load / clear ----------
function handleFile(file) {
  setStatus("Loading image…", 0);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    photo.img = img;
    photo.iw = img.naturalWidth;
    photo.ih = img.naturalHeight;
    fitPhotoContain();
    setStatus("Image loaded");
    URL.revokeObjectURL(url);
  };
  img.src = url; // blob:
}

function clearPhoto() {
  photo.img = null;
  photo.iw = photo.ih = 0;
  photo.rect = { x: 0, y: 0, w: 0, h: 0 };
  setStatus("Photo cleared");
}

// ---------- Export ----------
function exportPNG() {
  const filename = `canvas-${mode}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.png`;
  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      setStatus("PNG downloaded");
    }, "image/png");
    return;
  }
  const dataURL = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus("PNG downloaded");
}

// ---------- Render helpers ----------
function drawBackdrop() {
  const g = ctx.createLinearGradient(0, 0, view.cssW, view.cssH);
  g.addColorStop(0, "rgba(110,168,255,0.16)");
  g.addColorStop(1, "rgba(159,122,234,0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.cssW, view.cssH);
}

function drawPhoto() {
  if (photo.img) {
    ctx.imageSmoothingQuality = "high";
    const r = photo.rect;
    ctx.drawImage(photo.img, r.x, r.y, r.w, r.h);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 18px system-ui, 'PingFang TC', 'Noto Sans TC'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("點擊畫布上傳圖片 ✨", view.cssW / 2, view.cssH / 2);
  }
}

// Stars：一次畫完（在照片後面）
function drawStars() {
  ctx.fillStyle = "rgba(0,0,0,0.15)"; // 先在整個畫布上疊一層 15% 透明的黑色，讓背景更暗、星星更顯眼
  ctx.fillRect(0, 0, view.cssW, view.cssH);
  for (const s of stars) {
    const tw = s.baseA + s.twAmp * Math.sin(s.phase + time * s.twSpd * 2);
    ctx.globalAlpha = clamp(tw, 0, 1);
    const d = s.size * 6;
    ctx.drawImage(starSprite, s.x - d / 2, s.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1; // 還原透明度
}

// Snow：先更新全部，再分兩層繪製（背景 80% + 前景 20%）
function updateSnow() {
  for (const f of flakes) {
    f.phase += f.driftSpd / 60;
    f.x += Math.sin(f.phase) * f.driftAmp;
    f.y += f.vy;
    // 邊界回收：掉出畫布下緣（多 6px 緩衝，避免邊緣跳動感）就把雪花「傳送」回頂端，並隨機一個水平位置，形成無限循環的降雪
    if (f.y > view.cssH + 6) {
      f.y = -6;
      f.x = Math.random() * view.cssW;
    }
  }
}

function drawSnowLayer(startIndex, endIndex, foreground = false) {
  for (let i = startIndex; i < endIndex; i++) {
    const f = flakes[i];
    // foreground 決定要不要把它們畫得更大、更亮，來做景深
    const sizeBoost = foreground ? 1.25 : 1;
    const alphaBoost = foreground ? 1.1 : 1;
    ctx.globalAlpha = Math.min(1, f.a * alphaBoost);
    const d = f.size * 8 * sizeBoost;
    ctx.drawImage(snowSprite, f.x - d / 2, f.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1; // 還原狀態，避免影響後續繪圖
}

// ---------- Render loop ----------
function tick(ts) {
  time = (ts || 0) / 1000;
  render();
  requestAnimationFrame(tick);
}

function render() {
  drawBackdrop();

  if (mode === "stars") {
    // 星星在後 → 照片在上
    drawStars();
    drawPhoto();
  } else {
    // 雪花分層：先畫 80% 雪 → 照片 → 20% 前景雪
    ctx.fillStyle = "rgba(10,15,30,0.25)";
    ctx.fillRect(0, 0, view.cssW, view.cssH);

    updateSnow();
    const split = Math.floor(flakes.length * 0.8);
    drawSnowLayer(0, split, false); // 背景雪
    drawPhoto(); // 照片
    drawSnowLayer(split, flakes.length, true); // 前景雪
  }
}

init();
