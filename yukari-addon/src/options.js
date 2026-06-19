document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveBtn = document.getElementById("save-btn");
  const clearBtn = document.getElementById("clear-btn");
  const statusMsg = document.getElementById("status-msg");
  const historyContainer = document.getElementById("history-container");

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
