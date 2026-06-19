# ブラウザ拡張機能『ゆかりちゃんアドオン』基本仕様書

## 1. 概要
本プロジェクトは、antigravity cli（agy）を利用して開発・ビルドするブラウザ拡張機能（Manifest V3）である。画面右下に常駐する和風黒髪ロングのキャラクター「ゆかりちゃん」が、ユーザー（マスター）が画像を「つついて（クリックして）」呼び出した際、現在閲覧中のWebページのコンテキスト（タイトルやコンテンツ）を認識し、Gemini APIを介してお淑やかで博識なリアクションを行う。

---

## 2. ディレクトリ構成
ソースファイルとアセットは以下の構造で配置する。

yukari-addon/
├── agy.config.json       # agy cli の設定ファイル
├── manifest.json         # 拡張機能のマニフェスト (Manifest V3)
├── src/
│   ├── background.js     # サービスワーカー（Gemini API通信、履歴保存、状態管理）
│   ├── content.js        # コンテントスクリプト（UI表示、クリックイベント、ページ情報取得）
│   ├── options.html      # 設定画面（APIキー入力・履歴確認用UI）
│   └── options.js        # 設定画面のロジック
└── assets/
    ├── icons/            # 拡張機能自体のアイコン
    └── yukari_images/    # ゆかりちゃんの表情差分画像（背景白・透過処理済）
        ├── yukari_normal.png  # 通常
        ├── yukari_blush.png   # 照れ
        ├── yukari_happy.png   # 喜び
        ├── yukari_sad.png     # 悲しみ
        └── yukari_worry.png   # 疑問

---

## 3. 機能要件

### ① インタラクション・マスコットUI（content.js）
* 常駐表示: すべてのWebページの右下に固定配置（position: fixed）。z-index は最前面に設定。
* トリガー（つつく操作）: 画面上のゆかりちゃん画像がクリックされたことを検知し、その時点の「ページタイトル」および「選択されたテキスト、またはページの一部の文章」を抽出する。
* セリフ吹き出し: ゆかりちゃん画像の上部に発言を表示。APIから応答が返ってきたら、テキストをフェードイン表示する。
* 表情切り替え: 受信した感情ステート（normal, blush, happy, sad, worry）に応じて、yukari_images/yukari_●●.png の対応する画像へ切り替える。

### ② Gemini API 連携（background.js）
* 使用モデル: gemini-3.1-flash-lite（低レイテンシかつ構造化出力に優れるため）。
* システムプロンプトの固定化: 以下のキャラクター定義および出力フォーマットをシステム指示（systemInstruction）として固定。
  - 人格定義: あなたは「ゆかり（Yukari）」。和風で黒髪ロング、世間知らずだけど博識な、健気な女の子。ユーザーを「マスター」と呼び、丁寧で少しお淑やかな日本語で話す。マスターが現在開いているページの情報が渡されるので、それについて博識な豆知識を交えたり、健気に感想を述べたりする。
  - 出力形式: 応答は必ず指定のJSONフォーマットのみ（responseMimeType: "application/json"）とし、他のテキストは一切含めない。
* 出力JSON構造:
  {
    "text": "マスターへの返答メッセージ（ゆかりちゃんの口調）",
    "emotion": "normal | blush | happy | sad | worry"
  }

### ③ 履歴保存機能（background.js / chrome.storage）
* 保存トリガー: Gemini APIから正常に応答を受け取ったタイミングで実行。
* 保存データ構造: 将来的な要約機能の追加を見据え、まずは以下の項目を chrome.storage.local の配列（visit_history）に追記保存する。
  {
    "timestamp": "2026-06-19T12:34:56Z",
    "url": "https://example.com/page",
    "title": "ページのタイトル",
    "yukari_response": "ゆかりちゃんのセリフ内容"
  }

### ④ 設定管理（options.html / options.js）
* APIキー保存: ユーザーが自身のGemini APIキーを入力・保存するフォーム。
* 履歴の確認（簡易機能）: 保存された url と yukari_response の履歴リストを簡易的に閲覧・クリアできる領域を設ける。

---

## 4. 画面遷移・インタラクションフロー

[マスターがゆかりちゃんをつつく (クリック)]
       │
       ▼ (content.js)
[アクティブタブの「URL」「タイトル」「本文テキスト」を抽出]
       │
       ▼ (content.js から background.js へメッセージ送信)
[chrome.storage から APIキーを取得]
       │
       ▼ (background.js)
[Gemini API へページ情報を添えてリクエスト送信]
       │
       ▼
[Gemini から JSONレスポンスを受信] ➔ { text, emotion }
       │
       ▼ (background.js)
[履歴保存: URL、タイトル、ゆかりちゃんのセリフを chrome.storage に保存]
       │
       ▼ (background.js から content.js へデータを返却)
[UI更新: 画像を yukari_{emotion}.png に切り替え、吹き出しにセリフを表示]

---

## 5. agy cli 開発・ビルド運用

### agy.config.json の定義
  {
    "projectName": "yukari-addon",
    "srcDir": "src",
    "outputDir": "dist",
    "assets": ["manifest.json", "assets/**/*"],
    "watch": ["src/**/*", "manifest.json"]
  }

### 開発コマンド
* 開発時（監視モード）: agy dev
* プロダクションビルド（配布用 zip 生成）: agy build
