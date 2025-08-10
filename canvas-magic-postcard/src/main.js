const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// DPR-aware sizing
const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1)); // devicePixelRatio = 裝置實際像素 / CSS 像素
function resizeCanvasToDisplaySize() {
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = Math.round((cssWidth * 2) / 3); // keep 3:2
  const targetW = Math.floor(cssWidth * dpr);
  const targetH = Math.floor(cssHeight * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
}
function logicalScale() {
  // Normalize to CSS pixels
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 在高 DPI（Retina）螢幕上，若直接用 canvas.width = CSS寬度，畫面會顯得模糊。用 DPR 去放大繪製區域，確保圖像清晰。
  ctx.scale(dpr, dpr);
}

// Simple base64-embedded tiny PNG (checker-ish) to avoid CORS
const base64PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAvUlEQVR4nO3YMQrCQBBF0b8i0bqUo4e5Qx9w3WwG0d1bKQxGQe6cCcybHnJ9w1pXo3kC4x9o7kq3xgq7G7xw0gYwW5C2/cw8t8w3m3m3cJm2mF2o7yV7w2V2VdJ8E0W3aQ9Wz7X2o8kRkQm5t8o3mQy3G7o7k1z9qgQyAPYwQm8wEo8gCq8gPr2+1k9KfQx3J0p2oVwC1wK1wK1wK1wK1wK1wK1wK1wK1wK1wK9+N3rQwW7wQ5E8WQXo1xXbHqk9b6mJm8kCwJ0j7rSgAAAABJRU5ErkJggg==";

// Offscreen canvases for background original and filtered
const offA = document.createElement("canvas");
const offB = document.createElement("canvas");
const offCtxA = offA.getContext("2d");
const offCtxB = offB.getContext("2d");

// Stickers (very simple AABB hit test)
const stickers = [
  {
    id: "A",
    type: "rect",
    x: 60,
    y: 60,
    w: 120,
    h: 90,
    angle: 0,
    scale: 1,
    fill: "#e94f37",
    opacity: 1,
    blend: "source-over",
  },
  {
    id: "B",
    type: "tri",
    x: 300,
    y: 160,
    w: 120,
    h: 100,
    angle: 0,
    scale: 1,
    fill: "#f9c74f",
    opacity: 1,
    blend: "source-over",
  },
];
let selectedId = "A";

// UI
const $ = (sel) => document.querySelector(sel);
const blendSel = $("#blend");
const opacityRange = $("#opacity");
const rotateBtn = $("#rotate");
const scaleUpBtn = $("#scaleUp");
const resetBtn = $("#reset");
const filterSel = $("#filter");
const applyFilterBtn = $("#applyFilter");
const resetFilterBtn = $("#resetFilter");
const exportBtn = $("#exportPNG");
const transparentBgChk = $("#transparentBg");
const downloadLink = $("#downloadLink");

blendSel.addEventListener("change", () => {
  current().blend = blendSel.value;
  draw();
});
opacityRange.addEventListener("input", () => {
  current().opacity = parseFloat(opacityRange.value);
  draw();
});
rotateBtn.addEventListener("click", () => {
  current().angle = (current().angle + Math.PI / 12) % (Math.PI * 2);
  draw();
});
scaleUpBtn.addEventListener("click", () => {
  current().scale = Math.min(3, current().scale * 1.1);
  draw();
});
resetBtn.addEventListener("click", () => {
  Object.assign(current(), { angle: 0, scale: 1 });
  draw();
});

applyFilterBtn.addEventListener("click", () => {
  applyFilter(filterSel.value);
  draw();
});
resetFilterBtn.addEventListener("click", () => {
  resetBackground();
  draw();
});

exportBtn.addEventListener("click", async () => {
  const blob = await exportPNG({ transparentBg: transparentBgChk.checked });
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "magic-postcard.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // free the blob URL a little later to avoid Safari races
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function current() {
  return stickers.find((s) => s.id === selectedId) || stickers[0];
}

// Drag select/move
let dragging = false;
let dragOffset = { x: 0, y: 0 };
canvas.addEventListener("mousedown", (e) => {
  const pt = toCanvasPoint(e);
  const hit = hitTest(pt.x, pt.y);
  if (hit) {
    selectedId = hit.id;
    const s = current();
    dragOffset.x = pt.x - s.x;
    dragOffset.y = pt.y - s.y;
    dragging = true;
    syncPanel();
    draw();
  }
});
window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const pt = toCanvasPoint(e);
  const s = current();
  s.x = pt.x - dragOffset.x;
  s.y = pt.y - dragOffset.y;
  draw();
});
window.addEventListener("mouseup", () => (dragging = false));

// Helpers
function toCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return { x, y };
}

function hitTest(x, y) {
  // very simple AABB in world (un-rotated) space: we approximate by using the sticker's bbox
  // For better precision with rotation/scale we could invert transform, but MVP keeps it simple.
  for (let i = stickers.length - 1; i >= 0; i--) {
    const s = stickers[i];
    const halfW = (s.w * s.scale) / 2;
    const halfH = (s.h * s.scale) / 2;
    const bx = s.x - halfW;
    const by = s.y - halfH;
    const bw = halfW * 2;
    const bh = halfH * 2;
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      return s;
    }
  }
  return null;
}

// Background draw (gradient + embedded image)
const bg = { w: 600, h: 400, filter: "none" };
function initBackground() {
  offA.width = bg.w;
  offA.height = bg.h;
  offB.width = bg.w;
  offB.height = bg.h;

  // gradient
  const g = offCtxA.createLinearGradient(0, 0, bg.w, bg.h);
  g.addColorStop(0, "#0d1b2a");
  g.addColorStop(1, "#1b263b");
  offCtxA.fillStyle = g;
  offCtxA.fillRect(0, 0, bg.w, bg.h);

  // draw embedded image (tiny pattern) in the corner at 220x140
  const img = new Image();
  img.onload = () => {
    offCtxA.globalAlpha = 0.8;
    offCtxA.drawImage(img, 0, 0, img.width, img.height, 190, 70, 220, 140);
    offCtxA.globalAlpha = 1;
    // copy to B as working buffer
    offCtxB.clearRect(0, 0, bg.w, bg.h);
    offCtxB.drawImage(offCtxA.canvas, 0, 0);
    draw();
  };
  img.src = "data:image/png;base64," + base64PNG;
  bg.filter = "none";
}
function resetBackground() {
  offCtxB.clearRect(0, 0, bg.w, bg.h);
  offCtxB.drawImage(offCtxA.canvas, 0, 0);
  bg.filter = "none";
}

function applyFilter(kind) {
  // operate on offB
  const { width: w, height: h } = offB;
  const img = offCtxA.getImageData(0, 0, w, h); // 取得原始像素資料
  const data = img.data;

  if (kind === "grayscale") {
    //  灰階
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = data[i + 1] = data[i + 2] = y;
    }
    offCtxB.putImageData(img, 0, 0);
  } else if (kind === "pixelate") {
    // 像素化
    const block = 6;
    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        const i = (y * w + x) * 4;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2],
          a = data[i + 3];
        for (let yy = 0; yy < block; yy++) {
          for (let xx = 0; xx < block; xx++) {
            const j = ((y + yy) * w + (x + xx)) * 4;
            if (y + yy < h && x + xx < w) {
              data[j] = r;
              data[j + 1] = g;
              data[j + 2] = b;
              data[j + 3] = a;
            }
          }
        }
      }
    }
    offCtxB.putImageData(img, 0, 0);
  } else if (kind === "edge") {
    // 邊緣偵測
    const src = offCtxA.getImageData(0, 0, w, h);
    const out = offCtxB.createImageData(w, h);
    const k = [0, -1, 0, -1, 4, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let r = 0,
          gc = 0,
          b = 0;
        let idx = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const p = ((y + ky) * w + (x + kx)) * 4;
            r += src.data[p] * k[idx];
            gc += src.data[p + 1] * k[idx];
            b += src.data[p + 2] * k[idx];
            idx++;
          }
        }
        const q = (y * w + x) * 4;
        out.data[q] = Math.min(255, Math.max(0, 128 + r));
        out.data[q + 1] = Math.min(255, Math.max(0, 128 + gc));
        out.data[q + 2] = Math.min(255, Math.max(0, 128 + b));
        out.data[q + 3] = 255;
      }
    }
    offCtxB.putImageData(out, 0, 0);
  } else {
    resetBackground();
  }
  bg.filter = kind;
}

// Main draw
function draw() {
  resizeCanvasToDisplaySize();
  logicalScale();

  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;

  // background (optional)
  if (!transparentBgChk.checked) {
    ctx.drawImage(offB, 0, 0, offB.width, offB.height, 0, 0, cssW, cssH);
  } else {
    ctx.clearRect(0, 0, cssW, cssH);
  }

  // draw stickers
  for (const s of stickers) {
    ctx.save();
    ctx.globalCompositeOperation = s.blend || "source-over";
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.scale(s.scale, s.scale);
    // draw centered
    if (s.type === "rect") {
      roundRect(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 12);
      ctx.fillStyle = s.fill;
      ctx.fill();
    } else if (s.type === "tri") {
      ctx.beginPath();
      ctx.moveTo(0, -s.h / 2);
      ctx.lineTo(s.w / 2, s.h / 2);
      ctx.lineTo(-s.w / 2, s.h / 2);
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
    }
    // selection outline
    if (s.id === selectedId) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Export
function exportPNG({ transparentBg = false } = {}) {
  return new Promise((resolve) => {
    // render to a temporary offscreen canvas at 1x DPR
    const out = document.createElement("canvas");
    out.width = 600;
    out.height = 400;
    const c = out.getContext("2d");
    // background
    if (!transparentBg) {
      c.drawImage(offB, 0, 0);
    }
    // stickers
    for (const s of stickers) {
      c.save();
      c.globalCompositeOperation = s.blend || "source-over";
      c.globalAlpha = s.opacity ?? 1;
      c.translate(s.x, s.y);
      c.rotate(s.angle);
      c.scale(s.scale, s.scale);
      if (s.type === "rect") {
        roundRect(c, -s.w / 2, -s.h / 2, s.w, s.h, 12);
        c.fillStyle = s.fill;
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(0, -s.h / 2);
        c.lineTo(s.w / 2, s.h / 2);
        c.lineTo(-s.w / 2, s.h / 2);
        c.closePath();
        c.fillStyle = s.fill;
        c.fill();
      }
      c.restore();
    }
    out.toBlob((blob) => resolve(blob), "image/png");
  });
}

function syncPanel() {
  blendSel.value = current().blend;
  opacityRange.value = String(current().opacity);
}

// init
function onResize() {
  draw();
}
window.addEventListener("resize", onResize);

resizeCanvasToDisplaySize();
logicalScale();
initBackground();
syncPanel();
draw();
