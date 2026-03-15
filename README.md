# baited

走光性シミュレーション — 体験型インスタレーション

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

## オフライン対応

1. https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js を保存
2. `main/` に配置
3. `main/index.html` の CDN パスをローカルに変更

## 詳細

`ARCHITECTURE.md` を参照。
