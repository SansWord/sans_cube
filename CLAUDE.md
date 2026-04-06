# sans_cube

A Rubik's cube solve analyzer for speedcubers. Connects to GAN smart cubes via Web Bluetooth, records solves in real time, and breaks them down phase by phase (CFOP).

## Who is working on this

SansWord — a speedcuber who owns a GAN 12 UI Maglev. Familiar with cubing conventions (CFOP, notation, orientations like green front / yellow bottom). New to web development. Prefers guided decisions with clear options and recommendations rather than open-ended questions.

## Tech Stack

- React 19 + TypeScript + Vite
- Three.js for 3D cube rendering
- Web Bluetooth API via `gan-web-bluetooth` npm library (handles AES decryption for GAN Gen4 protocol)
- Vitest + Testing Library

**Important:** Web Bluetooth only works in Chromium-based browsers (Chrome/Edge). Keep this in mind for any browser-compatibility decisions.

## Key Architecture

**Drivers** (`src/drivers/`)
- `CubeDriver.ts` — abstract interface all drivers implement
- `GanCubeDriver.ts` — BLE connection to real GAN cubes
- `MouseDriver.ts` — simulates cube in browser via mouse drag
- `ButtonDriver.ts` — simulates cube via button clicks

**Hooks** (`src/hooks/`)
- `useCubeDriver` — manages driver lifecycle and connection
- `useCubeState` — tracks current cube state from move events
- `useGyro` — gyroscope orientation tracking
- `useGestureDetector` — detects gesture shortcuts (U×4 = reset gyro, D×4 = reset cube state)
- `useSolveRecorder` — records move sequences and timing for a solve
- `useSolveHistory` — persists solve history to localStorage
- `useTimer` — solve timer with CFOP phase detection
- `useScramble` / `useScrambleTracker` — scramble generation and tracking
- `useReplayController` — replay playback state (play/pause, speed, scrub)

**Components** (`src/components/`)
- `CubeCanvas` — Three.js 3D cube rendering with gyro orientation
- `TimerScreen` — main solve UI (timer, phases, scramble)
- `SolveDetailModal` — post-solve breakdown with replay
- `SolveHistorySidebar` — solve history list
- `PhaseBar` — CFOP phase timeline scrubber
- `SolveReplayer` — replay controls (play/pause, speed, scrub)
- `ScrambleDisplay` — scramble sequence with move highlighting
- `ConnectionBar` — BLE connection status and controls
- `OrientationConfig` — front/bottom face color config (persisted to localStorage)
- `TimerDisplay`, `ControlBar`, `MoveHistory`, `FaceletDebug`

## Persistence

- Solve history: `localStorage`
- Orientation config (front/bottom face): `localStorage`

## Development Commands

```bash
npm run dev       # start dev server
npm run build     # TypeScript check + Vite build
npm run test      # run Vitest tests
npm run lint      # ESLint
```

## Current State (as of 2026-04-06)

- **v0.2** complete and merged to main — timer mode with CFOP phase detection, scramble tracking, solve history
- Latest refactors: deduplicated mouse/touch drag logic, extracted `useReplayController`, added "Use this scramble" button in solve detail modal

## Planned Future Work

See `future.md` for the full backlog (single source of truth).

## GitHub Upload Safety

Before committing or pushing any file to GitHub, check for:
- Secrets, API keys, tokens, or passwords (hardcoded or in `.env` files)
- Private personal information beyond what's already public (name, email not intended to be public)
- Bluetooth device pairing keys or hardware identifiers
- Any file not meant to be public (e.g. `.env`, `*.pem`, `*.key`)

CLAUDE.md itself is safe to commit — it contains no secrets.
