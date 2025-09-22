// DOM 函式
const $ = (s) => document.querySelector(s);

// 支援/權限狀態顯示
const refresh = () => {
  const supported = "Notification" in window;
  $("#support").textContent = supported ? "YES" : "NO";
  $("#supportText").textContent = supported
    ? "✅ 支援 Notification"
    : "❌ 不支援 Notification";
  $("#perm").textContent = supported ? Notification.permission : "-";
};
refresh();

// 請求權限
$("#btnPerm").addEventListener("click", async () => {
  if (!("Notification" in window)) return alert("此瀏覽器不支援 Notification");
  if (Notification.permission === "granted") return alert("已允許通知");
  if (Notification.permission === "denied")
    return alert("你曾拒絕通知，請到瀏覽器設定開啟");
  const res = await Notification.requestPermission();
  alert("使用者選擇：" + res);
  refresh();
});

// 讀取表單
const readForm = () => ({
  title: $("#title").value.trim() || "通知",
  body: $("#body").value.trim(),
  icon: $("#icon").value.trim(),
  badge: $("#badge").value.trim(),
  tag: $("#tag").value.trim(),
});

// 共用：顯示系統通知
function showNotification() {
  const { title, body, icon, badge, tag } = readForm();
  try {
    new Notification(title, { body, icon, badge, tag });
  } catch (e) {
    alert("顯示通知失敗：" + e.message);
  }
}

// 清空
$("#btnClear").addEventListener("click", () => {
  $("#title").value = "新訊息";
  $("#body").value = "你的訂單已出貨";
  $("#icon").value = "";
  $("#badge").value = "";
  $("#tag").value = "";
});

// 立即：一鍵系統通知（最小可行示範）
$("#btnNotify").addEventListener("click", () => {
  if (!("Notification" in window)) return alert("此瀏覽器不支援 Notification");
  if (Notification.permission !== "granted")
    return alert("尚未允許通知，請先點擊「請求通知權限」");
  showNotification();
});

// 延遲：3 秒後跳系統通知（提示使用者切到別分頁，但不要關閉頁面）
$("#btnDelayed").addEventListener("click", () => {
  if (!("Notification" in window)) return alert("此瀏覽器不支援 Notification");
  if (Notification.permission !== "granted")
    return alert("尚未允許通知，請先點擊「請求通知權限」");

  alert(
    "提示：現在可以切到其他分頁（不要關閉這個頁面），3 秒後會跳出系統通知。"
  );
  setTimeout(() => {
    showNotification();
  }, 3000);
});
