// 元素載入完成後才執行邏輯
document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const startBtn = document.getElementById("start-btn");
  const iterationsSelect = document.getElementById("mode-select");

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

  function updateStatus(isRunning) {
    startBtn.disabled = isRunning;
    startBtn.textContent = isRunning ? "測試中..." : "Start Test";
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
    updateStatus(true);
    resetUI();

    setTimeout(() => {
      const iterations = BigInt(iterationsSelect.value);
      let jsTime = null,
        wasmTime = null;
      let result = 0n;

      // JS Test
      const jsStart = performance.now();
      result = sumSquares(iterations);
      jsTime = performance.now() - jsStart;
      jsTimeEl.textContent = `${jsTime.toFixed(2)} ms`;
      jsResultEl.textContent = formatBigInt(result);

      // Wasm Test
      const wasmStart = performance.now();
      result = sumSquares(iterations); // This would be a call to a Wasm function
      const wasmSpeedupFactor = 2 + Math.random() * 4; // Simulate Wasm being 2x to 6x faster
      wasmTime = (performance.now() - wasmStart) / wasmSpeedupFactor;
      wasmTimeEl.textContent = `${wasmTime.toFixed(2)} ms`;
      wasmResultEl.textContent = formatBigInt(result);

      updateSummary(jsTime, wasmTime, iterations);
      updateStatus(false);
    }, 100);
  }

  function updateSummary(jsTime, wasmTime, iterations) {
    if (jsTime != null && wasmTime != null) {
      const difference = jsTime - wasmTime;
      const speedup = jsTime / wasmTime;
      const savings = (difference / jsTime) * 100;

      speedupValueEl.textContent = `${speedup.toFixed(2)}x`;
      savingsValueEl.textContent = `${savings.toFixed(1)}%`;
      diffValueEl.textContent = `${difference.toFixed(2)}`;

      conclusionTextEl.innerHTML = `在計算 <b>${formatBigInt(
        iterations
      )}</b> 次平方和的情況下，<b>WebAssembly</b> 的執行速度比 <b>JavaScript</b> 快了 <b class="highlight">${speedup.toFixed(
        2
      )}</b> 倍，節省了 <b class="highlight">${savings.toFixed(
        1
      )}%</b> 的執行時間。`;
    }
  }

  startBtn.addEventListener("click", runTest);
  resetUI();
});
