const $ = (sel) => document.querySelector(sel);
const dtBox = $("#dt-box");

// draggable（拆成 start / flow）
const srcStart = $("#src-start");
const srcFlow = $("#src-flow");

// dropzone（enter / flow）
const tgtEnter = $("#tgt-enter");
const tgtFlow = $("#tgt-flow");

let currentDragId = null;
let enterFlashTimer = null;
let startFlashTimer = null;

/* ---------- 顯示工具：draggable ---------- */
const setSrcStart = (name, extra = "") => {
  srcStart.textContent = extra ? `${name} — ${extra}` : name;
  // 白色閃光
  srcStart.classList.remove("flash");
  void srcStart.offsetWidth; // reflow 以重新觸發動畫
  srcStart.classList.add("flash");
  clearTimeout(startFlashTimer);
  startFlashTimer = setTimeout(() => {}, 320);
};
const setSrcFlow = (name, extra = "") => {
  srcFlow.textContent = extra ? `${name} — ${extra}` : name;
};

/* ---------- 顯示工具：dropzone ---------- */
const setTgtEnter = (name, extra = "") => {
  tgtEnter.textContent = extra ? `${name} — ${extra}` : name;
  tgtEnter.classList.remove("flash");
  void tgtEnter.offsetWidth;
  tgtEnter.classList.add("flash");
  clearTimeout(enterFlashTimer);
  enterFlashTimer = setTimeout(() => {}, 320);
};
const setTgtFlow = (name, extra = "") => {
  tgtFlow.textContent = extra ? `${name} — ${extra}` : name;
};

/* ---------- throttle for dragover（降低覆蓋頻率） ---------- */
const throttle = (fn, ms) => {
  let t = 0;
  return (...args) => {
    const now = performance.now();
    if (now - t > ms) {
      t = now;
      fn(...args);
    }
  };
};
const throttledTgtFlow = throttle(setTgtFlow, 120);

/* ---------- draggable events ---------- */
document.querySelectorAll(".draggable").forEach((el) => {
  el.addEventListener("dragstart", (e) => {
    currentDragId = el.dataset.id; // 'A' | 'B'
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/plain", currentDragId);
    if (dtBox) dtBox.textContent = `type=text/plain, data=${currentDragId}`;
    setSrcStart("dragstart", `id=${currentDragId}`); // 專屬欄＋閃光
  });

  el.addEventListener("drag", () => {
    setSrcFlow("drag"); // 流動欄
  });

  el.addEventListener("dragend", () => {
    setSrcFlow("dragend"); // 流動欄
    currentDragId = null;
    if (dtBox) dtBox.textContent = "—";
  });
});

/* ---------- dropzone events ---------- */
["#drop-1", "#drop-2"].forEach((sel) => {
  const dz = document.querySelector(sel);

  dz.addEventListener("dragenter", () => {
    dz.classList.add("over");
    setTgtEnter("dragenter"); // 專屬欄＋閃光
  });

  dz.addEventListener("dragover", (e) => {
    e.preventDefault(); // 一律允許 drop
    throttledTgtFlow("dragover");
    if (dtBox)
      dtBox.textContent = `type=text/plain, data=${currentDragId ?? "—"}`;
  });

  dz.addEventListener("dragleave", () => {
    dz.classList.remove("over");
    setTgtFlow("dragleave");
  });

  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("over");

    const data = e.dataTransfer.getData("text/plain"); // 'A' | 'B'
    setTgtFlow("drop", `data=${data}`);
    if (dtBox) dtBox.textContent = `type=text/plain, data=${data}`;

    // 依來源上色與文案
    dz.classList.remove("bg-A", "bg-B");
    if (data === "A") {
      dz.classList.add("bg-A");
      dz.textContent = "已放下：A";
    } else if (data === "B") {
      dz.classList.add("bg-B");
      dz.textContent = "已放下：B";
    } else {
      dz.textContent = "已放下";
    }
  });
});
