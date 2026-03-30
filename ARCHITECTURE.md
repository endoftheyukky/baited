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
│  │  └──────┬──────┘  └─────┬─────┘  └───┬────┘ │                │
│  │         │               │             │       │                │
│  │         │          Audio Out     localStorage │                │
│  │         │               │             │       │                │
│  │  ┌──────▼──────┐        │             │       │                │
│  │  │connection.js│── WS ──▶ [server]    │       │                │
│  │  └─────────────┘                      │       │                │
│  └──────────┬────────────────────────────┘───────┘                │
│             │ HDMI (映像 + 音声)                                   │
│             ▼                                                      │
│  ┌──────────────────┐          ┌──────────────────────┐          │
│  │  Main Monitor    │          │  server/index.js      │          │
│  │  大画面TV         │          │  Express + WS + Logger│          │
│  │  (虫の映像 + BGM) │          │  :3000 HTTP           │          │
│  └──────────────────┘          │  :3001 WebSocket      │          │
│                                 │                       │          │
│                                 │  /status   接続監視    │          │
│                                 │  /analytics 体験記録   │          │
│                                 └────────┬──────────────┘          │
│                                          │ broadcast               │
├──────────────────────────────────────────┼────────────────────────┤
│                  Network Layer            │                        │
│                                           ▼                        │
│                              ┌──────────────────────┐             │
│                              │   Wi-Fi ルーター      │             │
│                              └──────────┬───────────┘             │
│                                          │                         │
├──────────────────────────────────────────┼────────────────────────┤
│                  Client Layer            │                         │
│                                          ▼                         │
│                                    ┌──────────┐                   │
│                                    │  iPad     │                   │
│                                    │  ピエロ映像 │                   │
│                                    │  (muted)  │                   │
│                                    └──────────┘                   │
│                                    sub-display/                    │
│                                    WebSocket client                │
└──────────────────────────────────────────────────────────────────┘
```

## フォルダ構成
```
baited/
├── package.json
├── README.md
├── ARCHITECTURE.md
│
├── server/
│   └── index.js            ← HTTP + WebSocket + analytics logger
│
├── main/                   ← メインディスプレイ（虫 + BGM）
│   ├── index.html          ← Click to start オーバーレイ付き
│   ├── sketch.js           ← p5.js シミュレーション本体
│   ├── connection.js       ← WS送信モジュール
│   ├── sound.js            ← Web Audio BGM（光ON/OFFでフェード）
│   ├── controls.js         ← Dキーでパラメータ調整（localStorage保存）
│   └── audio/
│       └── baited.wav
│
├── sub-display/            ← サブディスプレイ（iPad）
│   ├── index.html          ← muted自動再生
│   ├── client.js           ← WS受信 → 映像制御
│   └── videos/
│       └── video-1.mp4     ← ピエロ映像（ミュート再生）
│
└── logs/                   ← 体験データ（自動生成）
    └── YYYY-MM-DD.jsonl
```

## WebSocket プロトコル

### ポート
- HTTP: 3000
- WebSocket: 3001

### メッセージ形式

#### クライアント登録
```json
{ "type": "register", "role": "main" }
{ "type": "register", "role": "sub", "id": "1" }
```

#### 状態更新（Main → Server → iPad）
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
[sketch.js] ──50ms間隔──▶ [server] ──即座に転送──▶ [iPad]
     │                        │
     └──▶ [sound.js]          └──▶ [logs/YYYY-MM-DD.jsonl]
          (同一ページ内)             (ON/OFF時に記録)
```

## 各モジュールの責務

### server/index.js
- Express で静的ファイルを配信（`/` → main, `/sub` → sub-display）
- WebSocket でメイン → iPadへ状態を中継
- 光のON/OFFをJSONLログに記録
- `/status` — 接続中端末の一覧（5秒自動更新）
- `/analytics` — 日別・時間帯別の体験データ閲覧
- `/analytics/raw?date=YYYY-MM-DD` — 生データダウンロード

### main/sketch.js
- p5.js 虫シミュレーション（走光性アルゴリズム）
- mouseIsPressed → isLightOn（押している間だけ光がON）
- connection.js 経由で state を送信
- sound.update(isLightOn) で BGM 制御
- サーバーなしでも単体動作可能

### main/sound.js
- Web Audio API でアンビエントBGMをループ再生
- isLightOn → フェードイン (1.5s) / フェードアウト (2.0s)
- オーディオファイル未配置でもエラーなく動作

### main/controls.js
- D キーでパラメータパネル表示
- ↑↓←→ でリアルタイム調整、R でリセット
- 変更は即座に反映（虫の数・サイズは自動で再生成）
- localStorage に自動保存、再起動後も設定を保持
- アクティブな虫の数・FPS をリアルタイム表示

### sub-display/client.js
- WebSocket で state を受信
- isLightOn → ピエロ映像フェードイン / フェードアウト
- muted再生のためタップ不要で自動待機
- URLパラメータ `?id=N` で映像切替（拡張用に3台対応を維持）

## パラメータ調整

### 操作方法
| キー | 機能 |
|------|------|
| **D** | パネル表示/非表示 |
| **↑↓** | パラメータ選択 |
| **←→** | 値を増減（即座に反映・自動保存） |
| **R** | デフォルトに戻す |

### 調整可能なパラメータ
| パラメータ | 初期値 | 説明 |
|-----------|--------|------|
| `numBugs` | 250 | 虫の数（PCの性能に応じて） |
| `lightRadius` | 220 | 光の円の半径（モニターの大きさに応じて） |
| `bugSizeMin` | 14 | 虫の最小サイズ（モニターからの距離で） |
| `bugSizeMax` | 24 | 虫の最大サイズ |

### 固定パラメータ（コードで直接変更可能）
| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `reactionDelayMax` | 300 | 光ON後の反応遅延（フレーム） |
| `decayRateMin/Max` | 0.0004 / 0.0012 | 馴化の速さ |
| `recoveryRate` | 0.006 | 光OFF時の興味回復速度 |
| `boredomThreshold` | 0.15 | 飽き判定の閾値 |
| `broadcastInterval` | 50 | サーバーへの送信間隔（ms） |

## Analytics（体験データ記録）

### 記録タイミング
光のON/OFFイベント時のみ。サーバー負荷ほぼゼロ。

### 記録データ
```json
{
  "type": "session",
  "id": 1,
  "onTime": "2026-04-01T10:23:45.123Z",
  "offTime": "2026-04-01T10:24:12.456Z",
  "duration": 27.3,
  "startX": 500,
  "startY": 300,
  "endX": 480,
  "endY": 320
}
```

### 確認方法（同一Wi-Fi内のスマホから）
- `/analytics` — 日ごとの概要
- `/analytics?date=2026-04-01` — 時間帯別分布、体験時間の分布、全セッション一覧
- `/analytics/raw?date=2026-04-01` — JSONLダウンロード

### 分析できること
- 日ごと・時間帯ごとの体験者数
- 体験時間の平均・最短・最長・分布
- セッション間の空白時間（人が途切れた時間）
- 鑑賞者の「馴化カーブ」と虫のアルゴリズム上の馴化の比較

## 起動手順（展示当日）
```bash
# 1. メインPC
cd baited
npm start

# 2. Chrome で http://localhost:3000 を開く
#    「Click to start」をクリック → 外部モニターに移動 → F11で全画面

# 3. iPad の Safari で http://<PCのIP>:3000/sub?id=1 を開く
#    タップ不要、自動で待機状態になる

# 4. Wiimoteドライバーを起動してペアリング

# 5. (任意) パラメータ調整: D キーでパネル表示
#    → 設定はブラウザに保存されるので次回起動時も保持される
# 6. (任意) スマホで http://<PCのIP>:3000/status を開いて接続確認
```

## ネットワーク要件
- メインPC と iPad が同一LANに接続
- インターネット不要（p5.jsローカル保存で完全オフライン可）
- Wi-Fiルーター 1台（自前持ち込み推奨、5GHz推奨）