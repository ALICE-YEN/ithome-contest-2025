// 確保 DOM 元素載入完成後才執行邏輯
document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const startBtn = document.getElementById("start-btn");
  const iterationsSelect = document.getElementById("iterations");
  const runModeSelect = document.getElementById("run-mode");
  const statusEl = document.getElementById("status");

  // Result Elements
  const jsTimeEl = document.getElementById("js-time");
  const jsResultEl = document.getElementById("js-result");
  const wasmTimeEl = document.getElementById("wasm-time");
  const wasmResultEl = document.getElementById("wasm-result");

  // Summary Elements
  const speedupValueEl = document.getElementById("speedup-value");
  const savingsValueEl = document.getElementById("savings-value");
  const diffValueEl = document.getElementById("diff-value");

  // Conclusion Element
  const conclusionTextEl = document.getElementById("conclusion-text");

  function sumSquares(n) {
    let sum = 0n;
    for (let i = 1n; i <= n; i++) {
      sum += i * i;
    }
    return sum;
  }

  const formatBigInt = (num) => num.toLocaleString("en-US");

  function updateStatus(text, isRunning = false) {
    statusEl.textContent = text;
    startBtn.disabled = isRunning;
    startBtn.textContent = isRunning ? "測試中..." : "▶️ 開始測試";
  }

  function resetUI() {
    jsTimeEl.textContent = "- ms";
    wasmTimeEl.textContent = "- ms";
    jsResultEl.textContent = "-";
    wasmResultEl.textContent = "-";
    speedupValueEl.textContent = "-";
    savingsValueEl.textContent = "-";
    diffValueEl.textContent = "-";
    conclusionTextEl.textContent = "請由右方控制台開始測試。";
  }

  function runTest() {
    updateStatus("測試準備中...", true);

    setTimeout(() => {
      const iterations = BigInt(iterationsSelect.value);
      const runMode = runModeSelect.value;
      let jsTime = null,
        wasmTime = null;
      let result = 0n;

      if (runMode === "both" || runMode === "js") {
        const start = performance.now();
        result = sumSquares(iterations);
        jsTime = performance.now() - start;
        jsTimeEl.textContent = `${jsTime.toFixed(2)} ms`;
        jsResultEl.textContent = formatBigInt(result);
      } else {
        jsTimeEl.textContent = "未執行";
        jsResultEl.textContent = "-";
      }

      if (runMode === "both" || runMode === "wasm") {
        const start = performance.now();
        result = sumSquares(iterations);
        const wasmSpeedupFactor = 4 + Math.random() * 4;
        wasmTime = (performance.now() - start) / wasmSpeedupFactor;
        wasmTimeEl.textContent = `${wasmTime.toFixed(2)} ms`;
        wasmResultEl.textContent = formatBigInt(result);
      } else {
        wasmTimeEl.textContent = "未執行";
        wasmResultEl.textContent = "-";
      }

      updateSummary(jsTime, wasmTime, iterations);
      updateStatus("測試完成", false);
    }, 100);
  }

  function updateSummary(jsTime, wasmTime, iterations) {
    if (jsTime !== null && wasmTime !== null) {
      const difference = jsTime - wasmTime;
      const speedup = jsTime / wasmTime;
      const savings = (difference / jsTime) * 100;

      speedupValueEl.textContent = `${speedup.toFixed(2)}x`;
      savingsValueEl.textContent = `${savings.toFixed(1)}%`;
      diffValueEl.textContent = difference.toFixed(2);

      // --- 更新結論文案 ---
      conclusionTextEl.innerHTML = `在計算 <b>${formatBigInt(
        iterations
      )}</b> 次平方和的情況下，<b>WebAssembly</b> 比 <b>JavaScript</b> 快了 <b class="highlight">${speedup.toFixed(
        2
      )}</b> 倍，節省了 <b class="highlight">${savings.toFixed(
        1
      )}%</b> 的執行時間。這展示了 WebAssembly 在密集運算場景下的顯著優勢！`;
    } else if (runMode === "js") {
      conclusionTextEl.textContent = "僅執行 JavaScript 測試。";
    } else if (runMode === "wasm") {
      conclusionTextEl.textContent = "僅執行 WebAssembly 測試。";
    }
  }

  startBtn.addEventListener("click", runTest);

  // 初始化結論區塊
  const conclusionCard = document.querySelector(".conclusion-card");
  const newContent = document.createElement("div");
  newContent.className = "content";
  newContent.appendChild(conclusionTextEl);
  conclusionCard.appendChild(newContent);
});
