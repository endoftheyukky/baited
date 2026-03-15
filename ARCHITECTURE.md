# baited — System Architecture

## 全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                    Input Layer                                   │
│                                                                  │
│  [Wii Remote] ──Bluetooth HID──▶ [Wiimote Driver]              │
│                                    マウスエミュレーション         │
│                                         │                        │
│                                    OS Mouse Event                │
│                                         ▼                        │
├─────────────────────────────────────────────────────────────────┤
│                 Main PC (Windows Laptop)                         │
│                                                                  │
│  ┌──────────────┐    mouseX/Y     ┌──────────────────┐         │
│  │  Browser     │◀──────────────▶│  sketch.js        │         │
│  │  (Chrome)    │    isLightOn    │  p5.js 虫シミュ   │         │
│  │              │                 │  レーション        │         │
│  └──────┬───────┘                 └────────┬─────────┘         │
│         │ HDMI                              │                    │
│         ▼                                   │ WebSocket          │
│  ┌──────────────┐               ┌──────────▼─────────┐         │
│  │ Main Monitor │               │  server/index.js    │         │
│  │ 大画面TV      │               │  Express + WS       │         │
│  │ (虫の映像)    │               │  :3000 HTTP         │         │
│  └──────────────┘               │  :3001 WebSocket    │         │
│                                  └──────────┬─────────┘         │
│                                       ┌─────┴─────┐             │
│                                       │ broadcast  │             │
├───────────────────────────────────────┼───────────┼─────────────┤
│                  Network Layer         │           │              │
│                                        ▼           ▼              │
│                              ┌──────────────────────┐            │
│                              │   Wi-Fi ルーター      │            │
│                              │   (ローカルネットワーク)│            │
│                              └──┬────────┬────────┬─┘            │
│                                 │        │        │              │
├─────────────────────────────────┼────────┼────────┼──────────────┤
│                  Client Layer   │        │        │              │
│                                 ▼        ▼        ▼              │
│                            ┌────────┬────────┬────────┐         │
│                            │ iPad 1 │ iPad 2 │ iPad 3 │         │
│                            │ 映像:A │ 映像:B │ 映像:C │         │
│                            └────────┴────────┴────────┘         │
│                              sub-display/                        │
│                              WebSocket client                    │
│                              JS/HTML + <video>                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                  Sound Layer (Main PC上で動作)                    │
│                                                                  │
│  ┌──────────────────┐    Audio Out    ┌──────────────┐          │
│  │ sound/index.html │ ──────────────▶│  スピーカー    │          │
│  │ Web Audio API    │                 │              │          │
│  │ (別タブで起動)    │                 └──────────────┘          │
│  └──────────────────┘                                            │
│  WebSocket で isLightOn を受信                                    │
│  ON → フェードイン / OFF → フェードアウト                          │
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
│   └── index.js           ← 全静的ファイルも配信
│
├── main/                  ← メインディスプレイ（虫シミュレーション）
│   ├── index.html
│   ├── sketch.js          ← p5.js 本体
│   └── connection.js      ← WS送信モジュール
│
├── sub-display/           ← サブディスプレイ（iPad × 3）
│   ├── index.html         ← ?id=1, ?id=2, ?id=3 で映像切替
│   ├── client.js          ← WS受信 → 映像制御
│   └── videos/            ← 映像ファイル置き場
│       ├── video-1.mp4
│       ├── video-2.mp4
│       └── video-3.mp4
│
└── sound/                 ← サウンドシステム（メインPCの別タブ）
    ├── index.html
    ├── player.js           ← WS受信 → BGM制御
    └── audio/
        └── ambient.mp3     ← アンビエントBGM
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
{ "type": "register", "role": "sound" }   // サウンド
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
                                   ──即座に転送──▶ [sound]
```

## 各モジュールの責務

### server/index.js
- Express で全静的ファイルを配信
  - `/` → main/
  - `/sub` → sub-display/
  - `/sound` → sound/
- WebSocket でメッセージを中継
- メインからの state を全クライアントへブロードキャスト

### main/sketch.js
- p5.js 虫シミュレーション
- mouseIsPressed → isLightOn
- mouseX, mouseY → 光の座標
- connection.js 経由で state を送信
- サーバーなしでも単体動作可能

### sub-display/client.js
- WebSocket で state を受信
- isLightOn === true → 動画再生（フェードイン）
- isLightOn === false → 動画停止（フェードアウト）
- URLパラメータ `?id=N` で再生する映像を切替

### sound/player.js
- WebSocket で state を受信
- isLightOn === true → アンビエントBGM フェードイン
- isLightOn === false → フェードアウト
- Web Audio API でクロスフェード制御

## 起動手順（展示当日）

```bash
# 1. メインPCで
cd baited
npm install    # 初回のみ
npm start

# 2. ブラウザで開く
# メイン映像: http://localhost:3000          → HDMI外部モニターへ
# サウンド:   http://localhost:3000/sound    → 同じPCの別タブ
# 開発確認:   http://localhost:3000?dev      → 接続状態表示

# 3. 各iPadのSafariで開く
# iPad 1: http://<PCのIP>:3000/sub?id=1
# iPad 2: http://<PCのIP>:3000/sub?id=2
# iPad 3: http://<PCのIP>:3000/sub?id=3

# 4. Wiimoteドライバーを起動してペアリング
```

## ネットワーク要件
- メインPC と iPad が同一LANに接続
- インターネット不要（p5.jsローカル保存で完全オフライン可）
- Wi-Fiルーター 1台（5GHz推奨、レイテンシ低減）
