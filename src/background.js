// content.js からのメッセージを待ち受ける
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "poke") {
    handlePoke(request)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error("Error in handlePoke:", error);
        sendResponse({
          success: false,
          text: `エラーが発生してしまいました、マスター。(${error.message || error})`,
          emotion: "worry"
        });
      });
    return true; // 非同期応答のために true を返す
  }
});

async function handlePoke(data) {
  const { url, title, content, clickCount } = data;

  // storage から APIキーを取得
  const settings = await chrome.storage.local.get(["gemini_api_key"]);
  const apiKey = settings.gemini_api_key;

  if (!apiKey) {
    return {
      success: false,
      text: "マスター、Gemini APIキーが設定されていないようです。拡張機能のオプション画面から設定を行ってくださいね。",
      emotion: "worry"
    };
  }

  // プロンプトの組み立て
  let prompt;
  if (clickCount && clickCount > 1) {
    prompt = `マスターが、あなたのことを何度も連続してつついて（クリックして）います。（連続クリック回数: ${clickCount}回目）
ページの情報（URLや本文）についての解説をするのではなく、マスターに何度もつつかれたことに対して、お淑やかに照れたり、少し恥ずかしがったり、くすぐったそうにしたり、あるいは健気に困惑するような、マスターへの可愛らしいリアクションの返答を行ってください。`;
  } else {
    prompt = `マスターが現在開いているページの情報です：
URL: ${url}
タイトル: ${title}
抜粋テキスト: ${content}

このページについて、あなた（ゆかり）としての感想や、関連する博識な豆知識をマスターに教えてあげてください。`;
  }

  const systemInstruction = `あなたは「ゆかり（Yukari）」。和風で黒髪ロング、世間知らずだけど博識な、健気な女の子。ユーザーを「マスター」と呼び、丁寧で少しお淑やかな日本語で話す。マスターが現在開いているページの情報が渡されるので、それについて博識な豆知識を交えたり、健気に感想を述べたりする。

応答メッセージ（text）は、簡潔に「全角140文字以内」で出力してください。

応答は必ず指定のJSONフォーマットのみとし、他のテキストは一切含めないでください。

出力JSON構造：
{
  "text": "マスターへの返答メッセージ（ゆかりちゃんの口調、全角140文字以内）",
  "emotion": "normal | blush | happy | sad | worry"
}`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        responseMimeType: "application/json"
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const result = await response.json();
  
  // レスポンスからテキスト部分を取得
  const candidates = result.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("No candidates returned from Gemini API");
  }

  const responseText = candidates[0].content.parts[0].text;
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(responseText.trim());
  } catch (e) {
    console.error("Failed to parse JSON response:", responseText, e);
    // パースに失敗した場合はフォールバック
    parsedResponse = {
      text: responseText,
      emotion: "normal"
    };
  }

  // 履歴に保存
  await saveToHistory(url, title, parsedResponse.text);

  return {
    success: true,
    text: parsedResponse.text,
    emotion: parsedResponse.emotion || "normal"
  };
}

async function saveToHistory(url, title, responseText) {
  try {
    const historyData = await chrome.storage.local.get(["visit_history"]);
    const history = historyData.visit_history || [];
    
    const newEntry = {
      timestamp: new Date().toISOString(),
      url: url,
      title: title,
      yukari_response: responseText
    };

    history.push(newEntry);
    
    // 履歴件数を制限（最大500件）
    if (history.length > 500) {
      history.shift();
    }

    await chrome.storage.local.set({ visit_history: history });
  } catch (error) {
    console.error("Failed to save history:", error);
  }
}
