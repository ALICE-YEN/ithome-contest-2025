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

// Offscreen canvases for background original and filtered
const offA = document.createElement("canvas");
const offB = document.createElement("canvas");
const offCtxA = offA.getContext("2d");
const offCtxB = offB.getContext("2d");

// Stickers - 現在選中的會自動移到最後（最前面顯示）
const stickers = [
  {
    id: "A",
    type: "rect",
    x: 360,
    y: 260,
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
    x: 220,
    y: 180,
    w: 140,
    h: 120,
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

// 監聽透明背景勾選狀態變化
transparentBgChk.addEventListener("change", () => {
  draw(); // 重新繪製以反映背景變化
});

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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function current() {
  return stickers.find((s) => s.id === selectedId) || stickers[0];
}

// 將選中的 sticker 移到陣列最後（繪製順序最後，視覺上最前面，這樣 globalCompositeOperation 才會都有效）
function bringToFront(id) {
  const index = stickers.findIndex((s) => s.id === id);
  if (index !== -1 && index !== stickers.length - 1) {
    const sticker = stickers.splice(index, 1)[0];
    stickers.push(sticker);
  }
}

// Drag select/move
let dragging = false;
let dragOffset = { x: 0, y: 0 };
canvas.addEventListener("mousedown", (e) => {
  const pt = toCanvasPoint(e);
  const hit = hitTest(pt.x, pt.y);
  if (hit) {
    selectedId = hit.id;
    // 自動將選中的 sticker 帶到最前面
    bringToFront(selectedId);
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
  // 從後往前檢測（後畫的在上層，優先被點到）
  for (let i = stickers.length - 1; i >= 0; i--) {
    const s = stickers[i];
    const halfW = (s.w * s.scale) / 2;
    const halfH = (s.h * s.scale) / 2;
    const bx = s.x - halfW;
    const by = s.y - halfH;
    const bw = halfW * 2;
    const bh = halfH * 2;
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return s;
  }
  return null;
}

// Background
const bg = { w: 600, h: 400, filter: "none", loaded: true };

function initBackground() {
  offA.width = bg.w;
  offA.height = bg.h;
  offB.width = bg.w;
  offB.height = bg.h;

  // 彩色漸層背景，讓濾鏡效果明顯
  const g = offCtxA.createLinearGradient(0, 0, bg.w, bg.h);
  g.addColorStop(0, "#4a90e2"); // 明亮藍色
  g.addColorStop(0.5, "#f39c12"); // 橙色
  g.addColorStop(1, "#e74c3c"); // 紅色
  offCtxA.fillStyle = g;
  offCtxA.fillRect(0, 0, bg.w, bg.h);

  // 複製到濾鏡畫布
  offCtxB.clearRect(0, 0, bg.w, bg.h);
  offCtxB.drawImage(offCtxA.canvas, 0, 0);

  // 背景立即可用，無需等待載入
  draw();
}

function resetBackground() {
  offCtxB.clearRect(0, 0, bg.w, bg.h);
  offCtxB.drawImage(offCtxA.canvas, 0, 0);
  bg.filter = "none";
}

function applyFilter(kind) {
  const { width: w, height: h } = offB; // 從離屏畫布 offB 取寬高，之後會用到這兩個值做像素運算與邊界檢查
  const img = offCtxA.getImageData(0, 0, w, h); // 從原始背景畫布 offA 取得像素資料
  const data = img.data; // 是一個 Uint8ClampedArray，格式為 RGBA 連續排列，每 4 個值是一個像素

  if (kind === "grayscale") {
    // 灰階 - 增強對比
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      // 用感知亮度（Rec.709）計算灰階值 y，讓人眼感覺更自然
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // 增加對比度，以 128 為中心拉高對比（×1.5），再 夾限 到 0–255 避免溢位。
      const contrast = (y - 128) * 1.5 + 128;
      const final = Math.max(0, Math.min(255, contrast));
      data[i] = data[i + 1] = data[i + 2] = final;
    }
    offCtxB.putImageData(img, 0, 0); // 把處理後的影像寫回到輸出離屏 offCtxB
  } else if (kind === "pixelate") {
    // 像素化 - 調整區塊大小
    const block = 30;
    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        const i = (y * w + x) * 4;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2],
          a = data[i + 3];

        // 取該區塊左上角像素的 RGBA，當作整個區塊的顏色
        for (let yy = 0; yy < block; yy++) {
          for (let xx = 0; xx < block; xx++) {
            const ny = y + yy,
              nx = x + xx;
            if (ny >= h || nx >= w) continue; // 邊界要檢查，避免超出畫布
            const j = (ny * w + nx) * 4;
            data[j] = r;
            data[j + 1] = g;
            data[j + 2] = b;
            data[j + 3] = a;
          }
        }
      }
    }
    offCtxB.putImageData(img, 0, 0);
  } else if (kind === "edge") {
    // 邊緣偵測 - 增強效果
    const src = offCtxA.getImageData(0, 0, w, h);
    const out = offCtxB.createImageData(w, h);
    // 更強的邊緣偵測核心
    const k = [-2, -2, -2, -2, 16, -2, -2, -2, -2];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let r = 0,
          gc = 0,
          b = 0,
          idx = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const p = ((y + ky) * w + (x + kx)) * 4;
            const kv = k[idx++];
            r += src.data[p] * kv;
            gc += src.data[p + 1] * kv;
            b += src.data[p + 2] * kv;
          }
        }

        const q = (y * w + x) * 4;
        // 增強邊緣效果
        out.data[q] = Math.min(255, Math.max(0, Math.abs(r) * 1.5));
        out.data[q + 1] = Math.min(255, Math.max(0, Math.abs(gc) * 1.5));
        out.data[q + 2] = Math.min(255, Math.max(0, Math.abs(b) * 1.5));
        out.data[q + 3] = 255;
      }
    }
    offCtxB.putImageData(out, 0, 0);

    // 反轉顏色讓邊緣更明顯
    offCtxB.globalCompositeOperation = "difference";
    offCtxB.fillStyle = "#ffffff";
    offCtxB.fillRect(0, 0, w, h);
    offCtxB.globalCompositeOperation = "source-over";
  } else {
    resetBackground();
    return;
  }

  bg.filter = kind;
}

// Main draw
function draw() {
  resizeCanvasToDisplaySize();

  // 完整重置畫布狀態
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 在高 DPI（Retina）螢幕上，若直接用 canvas.width = CSS寬度，畫面會顯得模糊。用 DPR 去放大繪製區域，確保圖像清晰。
  ctx.scale(dpr, dpr);

  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;

  // 重置合成模式和透明度為預設值
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // 繪製背景（如果不是透明模式）
  if (!transparentBgChk.checked && offB.width && offB.height) {
    ctx.drawImage(offB, 0, 0, offB.width, offB.height, 0, 0, cssW, cssH);
  }

  // 繪製 stickers（按陣列順序，後面的覆蓋前面的）
  for (const s of stickers) {
    ctx.save();
    ctx.globalCompositeOperation = s.blend || "source-over";
    ctx.globalAlpha = s.opacity ?? 1;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.scale(s.scale, s.scale);

    if (s.type === "rect") {
      roundRect(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 12);
      ctx.fillStyle = s.fill;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -s.h / 2);
      ctx.lineTo(s.w / 2, s.h / 2);
      ctx.lineTo(-s.w / 2, s.h / 2);
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
    }

    // 被選擇時的輪廓
    if (s.id === selectedId) {
      ctx.lineWidth = 3; // 加粗選擇輪廓
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.setLineDash([8, 4]); // 更明顯的虛線
      ctx.strokeRect(-s.w / 2, -s.h / 2, s.w, s.h);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // 顯示當前狀態資訊
  displayStatus();
}

// 顯示狀態資訊
function displayStatus() {
  const status = document.getElementById("status");
  if (status) {
    const selectedSticker = current();
    status.textContent = `Selected: ${selectedSticker.type} | Filter: ${bg.filter}`;
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
    const out = document.createElement("canvas");
    out.width = 600;
    out.height = 400;
    const c = out.getContext("2d");

    if (!transparentBg) {
      c.drawImage(offB, 0, 0);
    }

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
  const s = current();
  blendSel.value = s.blend;
  opacityRange.value = String(s.opacity);
}

// 初始化
window.addEventListener("resize", () => draw());
resizeCanvasToDisplaySize();
initBackground();
syncPanel();
