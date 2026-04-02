# sans_cube

A Rubik's cube solve analyzer for speedcubers. Connects to your smart cube via Bluetooth, tracks your solve in real time, and breaks it down phase by phase.

Built by SansWord [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/sansword/)

---

## Features

- **Bluetooth connection** — pairs directly with GAN 12 UI via Web Bluetooth, no app required
- **CFOP phase breakdown** — Cross, F2L (4 slots), OLL, PLL with individual recognition and execution times
- **TPS per phase** — see exactly where you're fast and where you're slow
- **3D solve replay** — replay your solve with gyroscope orientation playback
- **Phase bar** — hover or drag to scrub through your solve timeline
- **Mouse mode** — simulate solves in the browser without a physical cube
- **Mobile support** — works on desktop and mobile with touch-native interactions

## Supported Hardware

| Cube | Status |
|---|---|
| GAN 12 UI | ✅ Supported |
| Other brands | 🔜 Planned |

## Supported Methods

| Method | Status |
|---|---|
| CFOP | ✅ Supported |
| ROUX | 🔜 Planned |
| ZZ | 🔜 Planned |

## Getting Started

```bash
npm install
npm run dev
```

Open the app in a Chromium-based browser (Web Bluetooth requires Chrome/Edge).

## Tech Stack

- React 19 + TypeScript
- Vite
- Three.js (3D cube rendering)
- Web Bluetooth API
- Vitest + Testing Library
