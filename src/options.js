document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveBtn = document.getElementById("save-btn");
  const clearBtn = document.getElementById("clear-btn");
  const statusMsg = document.getElementById("status-msg");
  const historyContainer = document.getElementById("history-container");
  const exportBtn = document.getElementById("export-btn");
  const importTriggerBtn = document.getElementById("import-trigger-btn");
  const importFile = document.getElementById("import-file");
  const backupStatusMsg = document.getElementById("backup-status-msg");

  // 初期読み込み
  loadSettings();

  // APIキーの保存
  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus("APIキーを入力してください。", "error");
      return;
    }

    chrome.storage.local.set({ gemini_api_key: apiKey }, () => {
      showStatus("APIキーを保存いたしました。", "success");
    });
  });

  // 履歴のクリア
  clearBtn.addEventListener("click", () => {
    if (confirm("これまでのゆかりちゃんとの会話履歴をすべて消去してもよろしいですか？")) {
      chrome.storage.local.set({ visit_history: [] }, () => {
        showStatus("履歴をクリアいたしました。", "success");
        renderHistory([]);
      });
    }
  });

  // バックアップのエクスポート (JSON形式)
  exportBtn.addEventListener("click", () => {
    chrome.storage.local.get(["gemini_api_key", "visit_history"], (data) => {
      const backupData = {
        gemini_api_key: data.gemini_api_key || "",
        visit_history: data.visit_history || []
      };
      
      try {
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `yukari_addon_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showBackupStatus("バックアップファイルを書き出しました。", "success");
      } catch (err) {
        showBackupStatus("書き出しに失敗しました: " + err.message, "error");
      }
    });
  });

  // バックアップのインポート
  importTriggerBtn.addEventListener("click", () => {
    importFile.click();
  });

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if (typeof importedData !== "object" || importedData === null) {
          throw new Error("無効なJSONフォーマットです。");
        }

        const updates = {};
        if (importedData.gemini_api_key !== undefined) {
          updates.gemini_api_key = importedData.gemini_api_key;
        }
        if (Array.isArray(importedData.visit_history)) {
          updates.visit_history = importedData.visit_history;
        }

        if (Object.keys(updates).length === 0) {
          throw new Error("復元可能なデータ（APIキーまたは履歴）が見つかりません。");
        }

        chrome.storage.local.set(updates, () => {
          showBackupStatus("バックアップから設定と履歴を復元しました。", "success");
          loadSettings();
          importFile.value = "";
        });
      } catch (err) {
        showBackupStatus("読み込みに失敗しました: " + err.message, "error");
        importFile.value = "";
      }
    };
    reader.readAsText(file);
  });

  function loadSettings() {
    chrome.storage.local.get(["gemini_api_key", "visit_history"], (data) => {
      if (data.gemini_api_key) {
        apiKeyInput.value = data.gemini_api_key;
      }
      
      const history = data.visit_history || [];
      renderHistory(history);
    });
  }

  function renderHistory(history) {
    if (history.length === 0) {
      historyContainer.innerHTML = '<div class="no-history">履歴はまだございません。</div>';
      return;
    }

    // 最新の履歴が上に来るように逆順にする
    const sortedHistory = [...history].reverse();

    let html = '<div class="history-list">';
    sortedHistory.forEach(item => {
      const dateStr = formatDate(item.timestamp);
      html += `
        <div class="history-item">
          <div class="history-meta">
            <span class="history-time">${dateStr}</span>
            <a href="${escapeHtml(item.url)}" target="_blank" class="history-url">${escapeHtml(item.url)}</a>
          </div>
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-response">${escapeHtml(item.yukari_response)}</div>
        </div>
      `;
    });
    html += '</div>';

    historyContainer.innerHTML = html;
  }

  function showStatus(message, type) {
    statusMsg.textContent = message;
    statusMsg.className = `status-msg ${type}`;
    statusMsg.style.opacity = 1;

    setTimeout(() => {
      statusMsg.style.opacity = 0;
    }, 3000);
  }

  function showBackupStatus(message, type) {
    backupStatusMsg.textContent = message;
    backupStatusMsg.className = `status-msg ${type}`;
    backupStatusMsg.style.opacity = 1;

    setTimeout(() => {
      backupStatusMsg.style.opacity = 0;
    }, 3000);
  }

  function formatDate(isoString) {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (e) {
      return isoString;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
