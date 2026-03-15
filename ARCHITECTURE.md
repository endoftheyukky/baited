# baited — System Architecture

## 全体構成図

```
┌──────────────────────────────────────────────────────────────────┐
│                    Input Layer                                    │
│                                                                   │
│  [Wii Remote] ──Bluetooth HID──▶ [Wiimote Driver]               │
│                                    マウスエミュレーション          │
│                                         │                         │
│                                    OS Mouse Event                 │
│                                         ▼                         │
├──────────────────────────────────────────────────────────────────┤
│                 Main PC (Windows Laptop)                          │
│                                                                   │
│  ┌──────────────────────────────────────────────┐                │
│  │  Browser (Chrome)                             │                │
│  │                                               │                │
│  │  ┌─────────────┐  ┌───────────┐  ┌────────┐ │                │
│  │  │ sketch.js   │  │ sound.js  │  │controls│ │                │
│  │  │ p5.js 虫    │  │ Web Audio │  │ .js    │ │                │
│  │  │ シミュレーション│  │ BGM制御   │  │ UI調整 │ │                │
│  │  └──────┬──────┘  └─────┬─────┘  └────────┘ │                │
│  │         │               │                     │                │
│  │         │          Audio Out ──────────▶ [スピーカー]          │
│  │         │                                     │                │
│  │  ┌──────▼──────┐                              │                │
│  │  │connection.js│── WebSocket ──▶ [server]     │                │
│  │  └─────────────┘                              │                │
│  └──────────┬────────────────────────────────────┘                │
│             │ HDMI                                                 │
│             ▼                                                      │
│  ┌──────────────────┐          ┌──────────────────┐              │
│  │  Main Monitor    │          │  server/index.js  │              │
│  │  大画面TV         │          │  Express + WS      │              │
│  │  (虫の映像)       │          │  :3000 HTTP        │              │
│  └──────────────────┘          │  :3001 WebSocket   │              │
│                                 └────────┬─────────┘              │
│                                          │ broadcast               │
├──────────────────────────────────────────┼────────────────────────┤
│                  Network Layer            │                        │
│                                           ▼                        │
│                              ┌──────────────────────┐             │
│                              │   Wi-Fi ルーター      │             │
│                              └──┬────────┬────────┬─┘             │
│                                 │        │        │               │
├─────────────────────────────────┼────────┼────────┼───────────────┤
│                  Client Layer   │        │        │               │
│                                 ▼        ▼        ▼               │
│                            ┌────────┬────────┬────────┐          │
│                            │ iPad 1 │ iPad 2 │ iPad 3 │          │
│                            │ 映像:A │ 映像:B │ 映像:C │          │
│                            │ +音声  │ +音声  │ +音声  │          │
│                            └────────┴────────┴────────┘          │
│                              sub-display/                         │
│                              WebSocket client                     │
│                              JS/HTML + <video>                    │
└──────────────────────────────────────────────────────────────────┘
```

## フォルダ構成

```
baited/
├── package.json           ← npm install / npm start
├── README.md              ← セットアップ手順
├── ARCHITECTURE.md        ← この文書
│
├── server/                ← WebSocket + HTTPサーバー
│   └── index.js           ← 静的ファイル配信 + WS中継
│
├── main/                  ← メインディスプレイ（虫 + BGM）
│   ├── index.html         ← Click to start オーバーレイ付き
│   ├── sketch.js          ← p5.js シミュレーション本体
│   ├── connection.js      ← WS送信モジュール
│   ├── sound.js           ← Web Audio BGM（光ON/OFFでフェード）
│   ├── controls.js        ← キーボードでパラメータ調整
│   └── audio/
│       └── ambient.mp3    ← アンビエントBGM
│
└── sub-display/           ← サブディスプレイ（iPad × 3）
    ├── index.html         ← Tap to start オーバーレイ付き
    ├── client.js          ← WS受信 → 映像+音声制御
    └── videos/
        ├── video-1.mp4    ← 映像+音声
        ├── video-2.mp4
        └── video-3.mp4
```

## WebSocket プロトコル

### ポート
- HTTP: 3000 (静的ファイル配信)
- WebSocket: 3001

### メッセージ形式

#### クライアント登録（接続時に送信）
```json
{ "type": "register", "role": "main" }    // メインディスプレイ
{ "type": "register", "role": "sub" }     // iPad
```

#### 状態更新（Main → Server → 全クライアント）
```json
{
  "type": "state",
  "isLightOn": true,
  "x": 500,
  "y": 300,
  "timestamp": 1710000000000
}
```

### データフロー

```
[sketch.js] ──50ms間隔──▶ [server] ──即座に転送──▶ [iPad 1,2,3]
     │
     └──▶ [sound.js]  (同一ページ内、直接参照、遅延なし)
```

## 各モジュールの責務

### server/index.js
- Express で静的ファイルを配信
  - `/` → main/
  - `/sub` → sub-display/
- WebSocket でメッセージを中継
- メインからの state を全サブクライアントへブロードキャスト

### main/sketch.js
- p5.js 虫シミュレーション
- mouseIsPressed → isLightOn
- mouseX, mouseY → 光の座標
- connection.js 経由で state を送信
- sound.update(isLightOn) を毎フレーム呼び出し
- サーバーなしでも単体動作可能

### main/sound.js
- Web Audio API でアンビエントBGMをループ再生
- isLightOn === true → フェードイン (1.5s)
- isLightOn === false → フェードアウト (2.0s)
- オーディオファイル未配置でもエラーなく動作

### main/controls.js
- D キーでパラメータパネル表示
- ↑↓←→ でリアルタイム調整
- R で全パラメータをデフォルトに戻す
- アクティブな虫の数・FPSを表示

### sub-display/client.js
- WebSocket で state を受信
- isLightOn === true → 動画再生（フェードイン、音声あり）
- isLightOn === false → 動画停止（フェードアウト）
- URLパラメータ `?id=N` で再生する映像を切替
- Tap to start で iOS の Autoplay 制限を解除

## 起動手順（展示当日）

```bash
# 1. メインPCで
cd baited
npm install    # 初回のみ
npm start

# 2. メインブラウザ（Chrome推奨）
# http://localhost:3000 を開く → 「Click to start」をクリック
# → HDMI外部モニターに虫の映像、PCスピーカーからBGM

# 3. 各iPadのSafari
# iPad 1: http://<PCのIP>:3000/sub?id=1 → 「Tap to start」をタップ
# iPad 2: http://<PCのIP>:3000/sub?id=2 → 同上
# iPad 3: http://<PCのIP>:3000/sub?id=3 → 同上

# 4. Wiimoteドライバーを起動してペアリング

# 5. (任意) パラメータ調整: D キーでパネル表示
```

## ネットワーク要件
- メインPC と iPad が同一LANに接続
- インターネット不要（p5.jsローカル保存で完全オフライン可）
- Wi-Fiルーター 1台（5GHz推奨、レイテンシ低減）

## オフライン対応

1. https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js をダウンロード
2. `main/` フォルダに配置
3. `main/index.html` の CDN パスを `<script src="p5.min.js">` に変更
