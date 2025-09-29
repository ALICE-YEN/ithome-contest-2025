const $ = (sel) => document.querySelector(sel);
const stack = $("#stack");
const rate = $("#rate");
const rateVal = $("#rateVal");

const btnExpand = $("#btnExpand");
const btnCollapse = $("#btnCollapse");
const btnShuffle = $("#btnShuffle");
const btnAdd = $("#btnAdd");
const btnRemove = $("#btnRemove");

// 撲克牌花色和數字
const suits = ["♠", "♥", "♦", "♣"];
const values = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

// 初始卡片數
let N = 5;
const cards = [];

function createCard(i) {
  const el = document.createElement("div");
  el.className = "card-item";

  // 隨機選擇花色和數字
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const value = values[Math.floor(Math.random() * values.length)];
  const isRed = suit === "♥" || suit === "♦";

  el.innerHTML = `
    <div class="card-corner top-left">
      <div class="card-value ${isRed ? "red" : ""}">${value}</div>
      <div class="card-suit ${isRed ? "red" : ""}">${suit}</div>
    </div>
    <div class="card-center ${isRed ? "red" : ""}">${suit}</div>
    <div class="card-corner bottom-right">
      <div class="card-value ${isRed ? "red" : ""}">${value}</div>
      <div class="card-suit ${isRed ? "red" : ""}">${suit}</div>
    </div>
  `;

  stack.appendChild(el);
  return el;
}

// 一次建立 N 張卡
for (let i = 1; i <= N; i++) cards.push(createCard(i));

// 幾何參數（展開位置）
function computeLayout() {
  const w = stack.clientWidth;
  const h = stack.clientHeight;
  const gap = 16;
  const cardW = 70;
  const cardH = 100;
  const cols = Math.max(2, Math.floor((w + gap) / (cardW + gap)));
  const rows = Math.ceil(cards.length / cols);
  const startX = (w - (cardW * cols + gap * (cols - 1))) / 2;
  const startY = (h - (cardH * rows + gap * (rows - 1))) / 2;

  const points = [];
  for (let i = 0; i < cards.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = startX + c * (cardW + gap);
    const y = startY + r * (cardH + gap);
    points.push({ x, y, r, c });
  }
  return points;
}

// 初始堆疊視覺
function setStackedVisual() {
  cards.forEach((el, i) => {
    const dx = (i - cards.length / 2) * 2;
    const dy = (cards.length - i) * 1.5;
    const rot = (i - cards.length / 2) * 1.5;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    el.style.opacity = String(Math.max(0.3, 1 - i * 0.06));
  });
}
setStackedVisual();

let expanded = false;
let animRefs = [];

function expand() {
  const points = computeLayout();
  // 若上一輪動畫還沒跑完，先取消，避免彼此覆蓋。
  animRefs.forEach((a) => a?.cancel());
  const currentRate = parseFloat(rate?.value || 1);
  animRefs = cards.map((el, i) => {
    const { x, y } = points[i];
    const rect = el.getBoundingClientRect();
    const parentRect = stack.getBoundingClientRect();
    const currentTransform = getComputedStyle(el).transform;
    const from =
      currentTransform === "none"
        ? `translate(${rect.left - parentRect.left}px, ${
            rect.top - parentRect.top
          }px)`
        : currentTransform;
    const to = `translate(${x}px, ${y}px) rotate(0deg)`;
    const delay = i * 40; // 階梯式進場
    const a = el.animate(
      [
        { transform: from, opacity: parseFloat(getComputedStyle(el).opacity) },
        { transform: to, opacity: 1 },
      ],
      {
        duration: 480,
        delay,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      }
    );
    a.playbackRate = currentRate;
    return a;
  });
  expanded = true;
}

function collapse() {
  animRefs.forEach((a) => a?.cancel()); // 先取消舊動畫。
  const currentRate = parseFloat(rate?.value || 1);
  animRefs = cards.map((el, i) => {
    const dx = (i - cards.length / 2) * 2;
    const dy = (cards.length - i) * 1.5;
    const rot = (i - cards.length / 2) * 1.5;
    const to = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    const from = getComputedStyle(el).transform;
    const delay = (cards.length - i) * 30;
    const a = el.animate(
      [
        { transform: from, opacity: parseFloat(getComputedStyle(el).opacity) },
        { transform: to, opacity: Math.max(0.3, 1 - i * 0.06) },
      ],
      {
        duration: 380,
        delay,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards",
      }
    );
    a.playbackRate = currentRate;
    return a;
  });
  expanded = false;
}

function updateRate(v) {
  animRefs.forEach((a) => a && (a.playbackRate = v));
  rateVal.textContent = `${v}×`;
}

function shuffle() {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  cards.forEach((el) => stack.appendChild(el));
  if (expanded) {
    expand();
  } else {
    setStackedVisual();
  }
}

function addCard() {
  const idx = cards.length + 1;
  cards.push(createCard(idx));
  if (expanded) {
    expand();
  } else {
    setStackedVisual();
  }
}

function removeCard() {
  if (!cards.length) return;
  const el = cards.pop();
  el.remove();
  if (expanded) {
    expand();
  } else {
    setStackedVisual();
  }
}

// 事件
btnExpand?.addEventListener("click", expand);
btnCollapse?.addEventListener("click", collapse);
btnShuffle?.addEventListener("click", shuffle);
btnAdd?.addEventListener("click", addCard);
btnRemove?.addEventListener("click", removeCard);
rate?.addEventListener("input", (e) => updateRate(Number(e.target.value)));

// 視窗改變尺寸
window.addEventListener("resize", () => {
  if (expanded) expand();
});
