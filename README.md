# baited
体験型インスタレーション — 走光性とアテンションエコノミー
鑑賞者が懐中電灯型デバイスで光を照射すると、ディスプレイ上の虫の群れが光源に集まり、やがて飽きて離散する。人々の注意と関心が資源として抽出される「アテンションエコノミー」の構造を、虫の走光性に翻訳した作品。
虫の動きは、対数螺旋（光コンパス反応）、レヴィフライト、ラン・アンド・タンブル、馴化といった実在の昆虫行動研究に基づくアルゴリズムで生成されている。

## セットアップ

```bash
cd baited
npm install
```

## 起動

```bash
npm start
```

ブラウザで以下を開く:

| URL | 用途 | 出力先 |
|-----|------|--------|
| `http://localhost:3000` | メイン映像（虫） | HDMIで外部モニター |
| `http://localhost:3000?fullscreen=1` | 同上（全画面） | |
| `http://localhost:3000/sound` | アンビエントBGM | PCのスピーカー |
| `http://<PCのIP>:3000/sub?id=1` | サブ映像 1 | iPad 1 |
| `http://<PCのIP>:3000/sub?id=2` | サブ映像 2 | iPad 2 |
| `http://<PCのIP>:3000/sub?id=3` | サブ映像 3 | iPad 3 |

## サーバーなしで動かす

`main/index.html` をブラウザで直接開く。虫のシミュレーションだけ動く。

## メディアファイルの配置

```
sub-display/videos/
  video-1.mp4    ← iPad 1 の映像
  video-2.mp4    ← iPad 2 の映像
  video-3.mp4    ← iPad 3 の映像

sound/audio/
  ambient.mp3    ← アンビエントBGM
```

## パラメータ調整

`main/sketch.js` 冒頭の `CONFIG`:

| パラメータ | 現在値 | 説明 |
|-----------|--------|------|
| `numBugs` | 250 | 虫の数 |
| `lightRadius` | 220 | 光の円の半径 (px) |
| `reactionDelayMax` | 300 | 光ON後の反応遅延 (0〜この値フレーム) |
| `decayRateMin/Max` | 0.0004 / 0.0012 | 飽き速度 (小さい=遅い) |
| `recoveryRate` | 0.006 | 光OFF時の興味回復速度 |
| `boredomThreshold` | 0.15 | この値以下で飽き判定 |

## 詳細

`ARCHITECTURE.md` を参照。
