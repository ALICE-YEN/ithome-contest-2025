document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM =====
  const startBtn = document.getElementById("start-btn");
  const iterationsSelect = document.getElementById("mode-select");

  // Results
  const jsTimeEl = document.getElementById("js-time");
  const jsResultEl = document.getElementById("js-result");
  const wasmTimeEl = document.getElementById("wasm-time");
  const wasmResultEl = document.getElementById("wasm-result");

  // Summary
  const speedupValueEl = document.getElementById("speedup-value");
  const savingsValueEl = document.getElementById("savings-value");
  const diffValueEl = document.getElementById("diff-value");

  // Conclusion
  const conclusionTextEl = document.getElementById("conclusion-text");

  // ===== Helpers =====
  const fmt = (n) => Number(n).toLocaleString("en-US");

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

  function sumSquaresJS(n) {
    // 使用 Number (JavaScript 的 Number 可處理大數)
    let sum = 0;
    for (let i = 1; i <= n; i++) {
      sum += i * i;
    }
    return sum;
  }

  function updateSummary(jsTime, wasmTime, iterations) {
    const diff = jsTime - wasmTime;
    const speedup = jsTime / wasmTime;
    const savings = (diff / jsTime) * 100;

    speedupValueEl.textContent = `${speedup.toFixed(2)}x`;
    savingsValueEl.textContent = `${savings.toFixed(1)}%`;
    diffValueEl.textContent = `${diff.toFixed(2)} ms`;

    conclusionTextEl.innerHTML =
      `在計算 <b>${fmt(iterations)}</b> 次平方和的情況下，` +
      `<b>WebAssembly</b> 比 <b>JavaScript</b> 快 ` +
      `<b class="highlight">${speedup.toFixed(2)}</b> 倍，` +
      `節省 <b class="highlight">${savings.toFixed(1)}%</b> 的執行時間。`;
  }

  // ===== Load Wasm (修正版：使用相對路徑) =====
  let wasmExports = null;
  async function ensureWasmLoaded() {
    if (wasmExports) return wasmExports;

    // 直接使用相對路徑，不依賴 document.currentScript
    const wasmUrl = "./js-vs-wasm/sum.wasm";

    console.log("嘗試載入 WASM:", wasmUrl);

    try {
      const resp = await fetch(wasmUrl);
      console.log("Fetch 狀態:", resp.status, resp.statusText);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      //檢查 Content-Type
      const contentType = resp.headers.get("content-type");
      console.log("Content-Type:", contentType);

      if (contentType && contentType.includes("text/html")) {
        throw new Error("伺服器回傳 HTML 而非 WASM 檔案，請檢查路徑");
      }

      const bytes = await resp.arrayBuffer();
      console.log("WASM 檔案大小:", bytes.byteLength, "bytes");

      // 檢查魔術字節
      const view = new Uint8Array(bytes);
      const magic = Array.from(view.slice(0, 4))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      console.log("檔案開頭魔術字節:", magic);

      if (magic !== "00 61 73 6d") {
        throw new Error(`檔案格式錯誤！期望: 00 61 73 6d，實際: ${magic}`);
      }

      // 提供 imports 物件(即使是空的也要提供)
      const importObject = {
        env: {
          // 64 位元乘法輔助函式(如果 WASM 需要的話)
          __multi3: (a, b, c, d) => {
            // 簡化實作:只處理小數字的情況
            const aLow = a >>> 0;
            const aHigh = b >>> 0;
            const bLow = c >>> 0;
            const bHigh = d >>> 0;

            // 簡單處理(假設高位元是 0)
            const result = BigInt(aLow) * BigInt(bLow);
            return Number(result & 0xffffffffn);
          },
        },
      };

      const { instance } = await WebAssembly.instantiate(bytes, importObject);

      if (
        !instance.exports.sumSquares ||
        typeof instance.exports.sumSquares !== "function"
      ) {
        throw new Error("sum.wasm 未匯出 sumSquares 函式（或型別不正確）。");
      }

      console.log("✅ WASM 載入成功！");
      wasmExports = instance.exports;
      return wasmExports;
    } catch (err) {
      console.error("❌ WASM 載入失敗:", err);
      throw err;
    }
  }

  // ===== Run test =====
  async function runTest() {
    try {
      updateStatus(true);
      resetUI();

      // 避免按下去 UI 還沒重繪
      await new Promise((r) => setTimeout(r, 30));

      const n = parseInt(iterationsSelect.value, 10);
      if (!Number.isFinite(n) || n <= 0) {
        conclusionTextEl.textContent = "請選擇正整數的迭代次數。";
        return;
      }

      // 預先載入 WASM
      const { sumSquares } = await ensureWasmLoaded();

      // 🔥 熱身:各跑 3 次不計時
      console.log("🔥 熱身中...");
      for (let i = 0; i < 3; i++) {
        sumSquaresJS(n);
        sumSquares(n);
      }

      await new Promise((r) => setTimeout(r, 100)); // 讓 CPU 穩定

      // 📊 正式測試:跑 5 次取平均
      const rounds = 5;
      const jsTimes = [];
      const wasmTimes = [];
      let jsResult, wasmResult;

      console.log("📊 正式測試開始...");

      for (let round = 0; round < rounds; round++) {
        // 隨機順序,避免順序偏差
        const runJsFirst = Math.random() > 0.5;

        if (runJsFirst) {
          // JS 先跑
          const jsStart = performance.now();
          jsResult = sumSquaresJS(n);
          jsTimes.push(performance.now() - jsStart);

          await new Promise((r) => setTimeout(r, 10)); // 短暫休息

          // WASM 後跑
          const wasmStart = performance.now();
          wasmResult = sumSquares(n);
          wasmTimes.push(performance.now() - wasmStart);
        } else {
          // WASM 先跑
          const wasmStart = performance.now();
          wasmResult = sumSquares(n);
          wasmTimes.push(performance.now() - wasmStart);

          await new Promise((r) => setTimeout(r, 10)); // 短暫休息

          // JS 後跑
          const jsStart = performance.now();
          jsResult = sumSquaresJS(n);
          jsTimes.push(performance.now() - jsStart);
        }

        console.log(
          `Round ${round + 1}: JS=${jsTimes[round].toFixed(
            2
          )}ms, WASM=${wasmTimes[round].toFixed(2)}ms`
        );
      }

      // 計算平均值(去掉最大最小值)
      const getAverage = (times) => {
        const sorted = [...times].sort((a, b) => a - b);
        const trimmed = sorted.slice(1, -1); // 去掉最大最小
        return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      };

      const jsTime = getAverage(jsTimes);
      const wasmTime = getAverage(wasmTimes);

      jsTimeEl.textContent = `${jsTime.toFixed(2)} ms`;
      jsResultEl.textContent = fmt(jsResult);
      wasmTimeEl.textContent = `${wasmTime.toFixed(2)} ms`;
      wasmResultEl.textContent = fmt(wasmResult);

      // Summary
      updateSummary(jsTime, wasmTime, n);

      console.log(
        `✅ 測試完成! JS平均: ${jsTime.toFixed(
          2
        )}ms, WASM平均: ${wasmTime.toFixed(2)}ms`
      );
    } catch (err) {
      console.error(err);
      conclusionTextEl.textContent = `執行失敗：${
        err?.message ?? err
      }. 請檢查 Console 查看詳細錯誤訊息。`;
    } finally {
      updateStatus(false);
    }
  }

  // ===== Bind =====
  startBtn.addEventListener("click", runTest);
  resetUI();
});
