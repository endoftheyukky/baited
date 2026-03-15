# baited

**体験型インスタレーション — 走光性とアテンションエコノミー**

鑑賞者が懐中電灯型デバイスで光を照射すると、ディスプレイ上の虫の群れが光源に集まり、やがて飽きて離散する。人々の注意と関心が資源として抽出される「アテンションエコノミー」の構造を、虫の走光性に翻訳した作品。

虫の動きは、対数螺旋（光コンパス反応）、レヴィフライト、ラン・アンド・タンブル、馴化といった実在の昆虫行動研究に基づくアルゴリズムで生成されている。

> 2026 Hosei University Composite Art Circle — Palette

## System

```
[Wii Remote] → Bluetooth → [Main PC] → HDMI → [Main Monitor]
                                │
                            WebSocket
                          ┌─────┼─────┐
                        [iPad] [iPad] [iPad]
                                │
                            [Speaker]
```

詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。

![機材構成図](./docs/hardware-diagram.png)
![システム構成図](./docs/system-diagram.png)

## Quick Start

```bash
npm install
npm start
# → http://localhost:3000
```

| URL | 用途 |
|-----|------|
| `localhost:3000` | メイン映像（虫） |
| `localhost:3000?fullscreen=1` | 全画面モード |
| `localhost:3000/sound` | アンビエントBGM |
| `<IP>:3000/sub?id=1,2,3` | サブディスプレイ（iPad） |

## Media Files (not in repo)

```
sub-display/videos/video-1.mp4, video-2.mp4, video-3.mp4
sound/audio/ambient.mp3
```

## Credits

| Role | Name |
|------|------|
| Direction / Creative Coding | Yuki Sunaga |
| Planner / System Engineering | Riko Fukami |
| Video Direction | Chiyori Oba |
| Video Edit | Yuki Sato |
| Sound Design | Mai Aritsuka |
