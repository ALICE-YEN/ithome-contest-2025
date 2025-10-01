const $ = (sel) => document.querySelector(sel);

const notesList = $("#notesList");
const noteInput = $("#noteInput");
const statusEl = $("#status");
const logEl = $("#log");
const dbVersionEl = $("#dbVersion");
const noteCountEl = $("#noteCount");
const dbStatusEl = $("#dbStatus");

const addBtn = $("#addBtn");
const getAllBtn = $("#getAllBtn");
const clearAllBtn = $("#clearAllBtn");
const deleteDBBtn = $("#deleteDBBtn");
const clearLogBtn = $("#clearLogBtn");

let db = null;
const DB_NAME = "MyNotesDB";
const DB_VERSION = 1;
const STORE_NAME = "notes";

// 日誌記錄
function log(msg, type = "info") {
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  const icon = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
  li.textContent = `[${time}] ${icon} ${msg}`;
  if (type === "error") li.style.color = "#ef4444";
  if (type === "success") li.style.color = "#10b981";
  logEl.appendChild(li);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(msg) {
  if (statusEl) {
    statusEl.textContent = msg;
  }
}

// 初始化資料庫
function initDB() {
  return new Promise((resolve, reject) => {
    log(`正在開啟資料庫: ${DB_NAME} v${DB_VERSION}`);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      log("資料庫開啟失敗", "error");
      dbStatusEl.textContent = "連接失敗";
      reject(request.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      log("資料庫開啟成功", "success");
      dbStatusEl.textContent = "已連接";
      dbVersionEl.textContent = db.version;
      setStatus("Database ready");
      updateNoteCount();
      loadAllNotes();
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      log("正在升級資料庫結構...");
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        log(`Object Store "${STORE_NAME}" 已建立`, "success");
      }
    };
  });
}

// 更新筆記數量
function updateNoteCount() {
  if (!db) return;

  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const countRequest = store.count();

  countRequest.onsuccess = () => {
    noteCountEl.textContent = countRequest.result;
  };
}

// 新增筆記
function addNote() {
  const content = noteInput.value.trim();

  if (!content) {
    setStatus("請輸入筆記內容");
    log("無法新增空白筆記", "error");
    return;
  }

  if (!db) {
    log("資料庫未連接", "error");
    return;
  }

  const note = {
    content,
    createdAt: Date.now(),
  };

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.add(note);

  request.onsuccess = () => {
    log(`筆記已新增 (ID: ${request.result})`, "success");
    setStatus("Note added");
    noteInput.value = "";
    updateNoteCount();
    loadAllNotes();
  };

  request.onerror = () => {
    log("新增筆記失敗", "error");
    setStatus("Failed to add note");
  };

  tx.oncomplete = () => {
    log("Transaction 完成");
  };
}

// 讀取所有筆記
function loadAllNotes() {
  if (!db) {
    log("資料庫未連接", "error");
    return;
  }

  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  request.onsuccess = () => {
    const notes = request.result;
    displayNotes(notes);
    log(`已讀取 ${notes.length} 筆記錄`, "success");
    setStatus(`Loaded ${notes.length} notes`);
  };

  request.onerror = () => {
    log("讀取筆記失敗", "error");
  };
}

// 顯示筆記
function displayNotes(notes) {
  if (notes.length === 0) {
    notesList.innerHTML =
      '<p class="empty-state">尚無筆記，請在右側新增 ✍️</p>';
    return;
  }

  notesList.innerHTML = notes
    .reverse()
    .map((note) => {
      const date = new Date(note.createdAt);
      const timeStr = date.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      return `
        <div class="note-card" data-id="${note.id}">
          <div class="note-header">
            <span class="note-id">#${note.id}</span>
            <div class="note-actions">
              <button class="edit-btn" onclick="editNote(${
                note.id
              })">✏️ 編輯</button>
              <button class="delete-btn" onclick="deleteNote(${
                note.id
              })">🗑️ 刪除</button>
            </div>
          </div>
          <div class="note-content">${escapeHtml(note.content)}</div>
          <div class="note-time">🕐 ${timeStr}</div>
        </div>
      `;
    })
    .join("");
}

// HTML 跳脫
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 編輯筆記
window.editNote = function (id) {
  if (!db) return;

  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(id);

  request.onsuccess = () => {
    const note = request.result;
    if (note) {
      const newContent = prompt("編輯筆記內容:", note.content);
      if (newContent !== null && newContent.trim()) {
        updateNote(id, newContent.trim());
      }
    }
  };
};

// 更新筆記
function updateNote(id, content) {
  if (!db) return;

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const getRequest = store.get(id);

  getRequest.onsuccess = () => {
    const note = getRequest.result;
    if (note) {
      note.content = content;
      note.updatedAt = Date.now();

      const updateRequest = store.put(note);

      updateRequest.onsuccess = () => {
        log(`筆記 #${id} 已更新`, "success");
        setStatus("Note updated");
        loadAllNotes();
      };

      updateRequest.onerror = () => {
        log(`更新筆記 #${id} 失敗`, "error");
      };
    }
  };
}

// 刪除筆記
window.deleteNote = function (id) {
  if (!db) return;

  if (!confirm(`確定要刪除筆記 #${id} 嗎？`)) return;

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.delete(id);

  request.onsuccess = () => {
    log(`筆記 #${id} 已刪除`, "success");
    setStatus("Note deleted");
    updateNoteCount();
    loadAllNotes();
  };

  request.onerror = () => {
    log(`刪除筆記 #${id} 失敗`, "error");
  };
};

// 清空所有筆記
function clearAllNotes() {
  if (!db) return;

  if (!confirm("確定要清空所有筆記嗎？此操作無法復原！")) return;

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.clear();

  request.onsuccess = () => {
    log("所有筆記已清空", "success");
    setStatus("All notes cleared");
    updateNoteCount();
    loadAllNotes();
  };

  request.onerror = () => {
    log("清空筆記失敗", "error");
  };
}

// 刪除資料庫
function deleteDatabase() {
  if (!confirm("確定要刪除整個資料庫嗎？所有資料將永久消失！")) return;

  if (db) {
    db.close();
    db = null;
  }

  const request = indexedDB.deleteDatabase(DB_NAME);

  request.onsuccess = () => {
    log("資料庫已刪除", "success");
    setStatus("Database deleted");
    dbStatusEl.textContent = "未連接";
    dbVersionEl.textContent = "-";
    noteCountEl.textContent = "0";
    notesList.innerHTML =
      '<p class="empty-state">資料庫已刪除，請重新整理頁面</p>';
  };

  request.onerror = () => {
    log("刪除資料庫失敗", "error");
  };

  request.onblocked = () => {
    log("資料庫刪除被阻擋（可能有其他頁籤正在使用）", "error");
  };
}

// 事件監聽
addBtn.addEventListener("click", addNote);
getAllBtn.addEventListener("click", loadAllNotes);
clearAllBtn.addEventListener("click", clearAllNotes);
deleteDBBtn.addEventListener("click", deleteDatabase);
clearLogBtn.addEventListener("click", () => (logEl.innerHTML = ""));

// 快捷鍵：Enter 新增
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    addNote();
  }
});

// 初始化
initDB().catch((err) => {
  log(`初始化失敗: ${err.message}`, "error");
  dbStatusEl.textContent = "初始化失敗";
});

log("IndexedDB Demo 已載入");
log("💡 提示: 使用 Cmd/Ctrl + Enter 快速新增筆記");
