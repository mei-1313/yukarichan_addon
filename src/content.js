(function() {
  // すでにUIが存在する場合は二重に作らない
  if (document.getElementById("yukari-addon-container")) return;

  // スタイルの注入
  const style = document.createElement("style");
  style.textContent = `
    #yukari-addon-container {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      font-family: 'Noto Serif JP', 'Georgia', serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      pointer-events: none;
      user-select: none;
    }
    
    #yukari-balloon {
      position: relative;
      background: rgba(255, 253, 251, 0.95);
      border: 1px solid #e2d1c3;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 12px;
      max-width: 280px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(8px);
      pointer-events: auto;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      color: #3e2723;
      font-size: 14px;
      line-height: 1.6;
    }

    #yukari-balloon.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* 吹き出しのしっぽ */
    #yukari-balloon::after {
      content: "";
      position: absolute;
      bottom: -8px;
      right: 40px;
      border-width: 8px 8px 0;
      border-style: solid;
      border-color: rgba(255, 253, 251, 0.95) transparent;
      display: block;
      width: 0;
    }
    #yukari-balloon::before {
      content: "";
      position: absolute;
      bottom: -9px;
      right: 40px;
      border-width: 9px 9px 0;
      border-style: solid;
      border-color: #e2d1c3 transparent;
      display: block;
      width: 0;
      z-index: -1;
    }

    #yukari-balloon-text {
      word-break: break-all;
    }

    #yukari-mascot-wrapper {
      position: relative;
      pointer-events: auto;
      cursor: pointer;
    }

    #yukari-mascot {
      width: 80px;
      height: auto;
      display: block;
      transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), filter 0.3s ease;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    }

    #yukari-mascot-wrapper:hover #yukari-mascot {
      transform: translateY(-4px) scale(1.02);
      filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
    }

    #yukari-mascot-wrapper:active #yukari-mascot {
      transform: translateY(2px) scale(0.98);
    }

    /* アニメーション用のクラス */
    .yukari-thinking {
      display: inline-block;
      animation: yukari-pulse 1.4s infinite ease-in-out both;
    }
    .yukari-thinking:nth-child(2) { animation-delay: 0.2s; }
    .yukari-thinking:nth-child(3) { animation-delay: 0.4s; }

    @keyframes yukari-pulse {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0); }
    }

    .yukari-shake {
      animation: yukari-shake-anim 0.5s ease-in-out;
    }

    @keyframes yukari-shake-anim {
      0%, 100% { transform: rotate(0deg); }
      20%, 60% { transform: rotate(-5deg); }
      40%, 80% { transform: rotate(5deg); }
    }

    /* 閉じるボタン */
    #yukari-close {
      position: absolute;
      top: 4px;
      right: 6px;
      font-size: 10px;
      color: #8d6e63;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    #yukari-close:hover {
      opacity: 1;
    }

    /* 設定ボタン */
    #yukari-settings {
      position: absolute;
      top: 4px;
      right: 20px;
      font-size: 10px;
      color: #8d6e63;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    #yukari-settings:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // フォントの追加 (Noto Serif JP)
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap";
  document.head.appendChild(link);

  // UIコンテナの構築
  const container = document.createElement("div");
  container.id = "yukari-addon-container";

  const balloon = document.createElement("div");
  balloon.id = "yukari-balloon";
  balloon.innerHTML = `
    <div id="yukari-close">×</div>
    <div id="yukari-settings">⚙️</div>
    <div id="yukari-balloon-text">こんにちは、マスター。御用でしょうか？</div>
  `;

  const mascotWrapper = document.createElement("div");
  mascotWrapper.id = "yukari-mascot-wrapper";

  const mascotImg = document.createElement("img");
  mascotImg.id = "yukari-mascot";
  mascotImg.src = chrome.runtime.getURL("assets/yukari_images/yukari_normal.png");
  mascotImg.alt = "ゆかりちゃん";

  mascotWrapper.appendChild(mascotImg);
  container.appendChild(balloon);
  container.appendChild(mascotWrapper);
  document.body.appendChild(container);

  let isThinking = false;
  let autoHideTimer = null;
  let lastUrl = null;
  let clickCount = 0;

  // 閉じるボタンのイベント
  balloon.querySelector("#yukari-close").addEventListener("click", (e) => {
    e.stopPropagation();
    hideBalloon();
  });

  // 設定ボタンのイベント
  balloon.querySelector("#yukari-settings").addEventListener("click", (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: "open_options" });
  });

  // 設定リンクのクリックイベント（デリゲーション）
  balloon.addEventListener("click", (e) => {
    if (e.target && e.target.id === "yukari-open-settings-link") {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: "open_options" });
    }
  });

  function showBalloon(text, html = false) {
    const textEl = document.getElementById("yukari-balloon-text");
    if (html || text.includes("<a ") || text.includes("<span ")) {
      textEl.innerHTML = text;
    } else {
      textEl.textContent = text;
    }
    balloon.classList.add("show");
    
    // 自動消去のタイマー設定 (15秒)
    if (autoHideTimer) clearTimeout(autoHideTimer);
    if (!isThinking) {
      autoHideTimer = setTimeout(() => {
        hideBalloon();
      }, 15000);
    }
  }

  function hideBalloon() {
    balloon.classList.remove("show");
    setEmotion("normal");
  }

  // つつく（クリック）操作
  mascotWrapper.addEventListener("click", () => {
    if (isThinking) return;

    // クリックアニメーション
    mascotWrapper.classList.add("yukari-shake");
    setTimeout(() => {
      mascotWrapper.classList.remove("yukari-shake");
    }, 500);

    // 情報の抽出
    const url = window.location.href;
    const title = document.title;

    // 連続クリックの判定
    if (url === lastUrl) {
      clickCount++;
    } else {
      lastUrl = url;
      clickCount = 1;
    }

    // 表情をworryにして、考え中に移行
    setEmotion("worry");
    isThinking = true;
    
    if (clickCount > 1) {
      showBalloon('……マスター？<span class="yukari-thinking">.</span><span class="yukari-thinking">.</span><span class="yukari-thinking">.</span>', true);
    } else {
      showBalloon('お調べしております、マスター<span class="yukari-thinking">.</span><span class="yukari-thinking">.</span><span class="yukari-thinking">.</span>', true);
    }

    // 選択テキスト、または本文の抽出
    let selectedText = window.getSelection().toString().trim();
    let content = selectedText;

    if (!content) {
      // 本文から主な文章を取得（とりあえず最初の1200文字程度）
      const paragraphs = Array.from(document.querySelectorAll("p, article, main"))
        .map(el => el.innerText.trim())
        .filter(text => text.length > 20);
      
      content = paragraphs.join("\n").substring(0, 1200);
      
      // それでも取得できなければ document.body.innerText
      if (!content) {
        content = document.body.innerText.substring(0, 1000).trim();
      }
    }

    // background.js へメッセージ送信
    chrome.runtime.sendMessage({
      action: "poke",
      url: url,
      title: title,
      content: content,
      clickCount: clickCount
    }, (response) => {
      isThinking = false;
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        setEmotion("worry");
        showBalloon("マスター、何か調子が悪いようでございます……。(通信に失敗しました)");
        return;
      }

      if (response && response.success) {
        setEmotion(response.emotion);
        showBalloon(response.text);
      } else {
        setEmotion(response ? response.emotion : "worry");
        showBalloon(response ? response.text : "マスター、何か調子が悪いようでございます……。");
      }
    });
  });

  // 感情画像の切り替え
  function setEmotion(emotion) {
    const validEmotions = ["normal", "blush", "happy", "sad", "worry"];
    const emo = validEmotions.includes(emotion) ? emotion : "normal";
    mascotImg.src = chrome.runtime.getURL(`assets/yukari_images/yukari_${emo}.png`);
  }

})();
