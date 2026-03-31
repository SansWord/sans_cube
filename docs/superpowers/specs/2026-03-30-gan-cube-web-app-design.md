# GAN Cube Web App — Phase 1 Design

**Date:** 2026-03-30
**Scope:** BLE connectivity, 3D cube display, gyroscope sync, solve recording and replay
**Out of scope (phase 2):** Scramble generator, multi-phase timer, additional cube brand support

---

## 1. Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React + Vite | Component model suits multiple real-time data streams; Vite for fast DX |
| 3D rendering | Three.js | Lightweight, large community, sufficient for a cube viewer |
| BLE protocol | `gan-web-bluetooth` (npm) | MIT-licensed, battle-tested, supports GAN 12 UI Maglev (Gen4) including AES decryption and gyroscope |
| Language | TypeScript (`.ts` / `.tsx`) | Type safety across the driver abstraction layer |

---

## 2. Architecture Overview

```
React App (Vite)
│
├── Components (UI)
│   ├── ConnectionBar        — connect / disconnect + status indicator
│   ├── ControlBar           — reset cube state, reset gyro buttons
│   ├── CubeCanvas           — Three.js 3D cube (animated rotations + gyro orientation)
│   ├── OrientationConfig    — front/bottom face color pickers + "use current" button
│   ├── MoveHistory          — scrollable move list (foundation for future timer)
│   └── SolveReplayer        — playback UI: play/pause, speed slider (0.5×–2×), scrub bar
│
├── Hooks (logic)
│   ├── useCubeDriver        — BLE lifecycle, emits normalized events
│   ├── useCubeState         — 54-facelet state tracker, manual reset
│   ├── useGyro              — quaternion with reference offset, manual reset
│   ├── useGestureDetector   — move sequence pattern matcher
│   └── useSolveRecorder     — records moves + timestamps per solve session
│
└── CubeDriver (abstraction layer)
    ├── CubeDriver (interface)  — the only type the rest of the app sees
    └── GanCubeDriver           — wraps gan-web-bluetooth, translates to CubeDriver events
        (future: MoyuCubeDriver, QiyiCubeDriver, …)
```

---

## 3. CubeDriver Abstraction Layer

The `CubeDriver` interface is the boundary between BLE protocol details and the React app. No component or hook imports from `gan-web-bluetooth` directly.

```typescript
interface Move {
  face: 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
  direction: 'CW' | 'CCW';
  cubeTimestamp: number; // cube internal clock in ms
  serial: number;        // move counter, used for gap detection
}

interface CubeState {
  facelets: string; // 54-char Kociemba notation e.g. "UUUUU...BBBBB"
}

interface Quaternion {
  x: number; y: number; z: number; w: number;
}

interface CubeDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  requestState(): Promise<void>;

  on(event: 'move',       handler: (move: Move) => void): void;
  on(event: 'state',      handler: (state: CubeState) => void): void;
  on(event: 'gyro',       handler: (q: Quaternion) => void): void;
  on(event: 'connection', handler: (status: 'connected' | 'disconnected') => void): void;
}
```

`GanCubeDriver` subscribes to the `gan-web-bluetooth` RxJS observable and translates each event type into the common format above. Adding a new cube brand means implementing `CubeDriver` — nothing else changes.

---

## 4. Hooks

### `useCubeDriver`
Manages driver instantiation and BLE lifecycle. Exposes `connect()`, `disconnect()`, `connectionStatus`, and an event emitter that other hooks subscribe to. Detects the cube brand from BLE advertising data and instantiates the correct driver.

### `useCubeState`
Maintains the 54-facelet cube state. Updates on every `move` event using `cubing.js` for move application and solved-state detection. Exposes `resetState()` which marks the current arrangement as solved without reconnecting.

### `useGyro`
Receives raw quaternion from `gyro` events. Stores a reference quaternion (set by calling `resetGyro()` — returned from this hook — or derived from the orientation config in `localStorage`). Applies the inverse of the reference to every incoming quaternion before passing to `CubeCanvas`, so the 3D cube is always relative to the user's preferred orientation. `resetGyro()` is a UI-side operation only — no BLE command is sent.

### `useGestureDetector`
Watches the move stream. Matches configurable patterns within a time window (default 2 seconds). Built-in shortcuts:

| Gesture | Action |
|---|---|
| U × 4 consecutive | Reset gyro orientation |
| D × 4 consecutive | Reset cube state |

The pattern list is configurable — future shortcuts can be added without changing the hook's internals.

### `useSolveRecorder`
Records `{ move, cubeTimestamp }` entries. Starts recording on the first move after the cube is in a solved state. Stops and emits a `SolveSession` when solved state is reached again. The `SolveSession` is passed to `SolveReplayer`.

```typescript
interface SolveSession {
  moves: Array<{ move: Move; cubeTimestamp: number }>;
  startTimestamp: number;
  endTimestamp: number;
}
```

---

## 5. 3D Rendering (CubeCanvas + Three.js)

`CubeCanvas` owns the Three.js scene. It renders a 3×3×3 cube made of 26 visible cubies, each face colored according to the current `CubeState`.

**Animated rotations:** Every move triggers an animation that rotates the correct layer over a configurable duration. During live solving, the animation duration is short (≈80ms) for responsiveness. During replay, the duration is derived from the timestamp delta between moves, scaled by the playback speed multiplier.

**Gyro sync:** The entire cube mesh's `quaternion` is set from `useGyro`'s output on every gyro event. Three.js applies this directly — no per-frame polling needed.

**Replay mode:** `SolveReplayer` drives `CubeCanvas` by scheduling moves with `setTimeout` intervals: `interval = (nextTimestamp - currentTimestamp) / speedMultiplier`. Play/pause suspends and resumes the queue. The scrub bar maps to a position in the `SolveSession.moves` array.

---

## 6. Orientation Config

Persisted to `localStorage` as `{ frontFace: Color, bottomFace: Color }`.

- **Dropdowns:** user picks front face color and bottom face color from a list of 6 standard cube colors
- **"Use current orientation" button:** captures the current gyro quaternion and saves it as the reference orientation — equivalent to `resetGyro()` but also writes to `localStorage` as the default for future sessions

On app load, `useGyro` initializes its reference quaternion from `localStorage` if present.

---

## 7. UI Layout (rough)

```
┌──────────────────────────────────────────┐
│  [Connect]  Status: Connected  [Disconnect] │  ← ConnectionBar
│  [Reset Gyro]  [Reset Cube State]           │  ← ControlBar
├──────────────────────────────────────────┤
│                                          │
│           3D Cube (Three.js)             │  ← CubeCanvas
│                                          │
├──────────────────────────────────────────┤
│  Front: [Green ▾]  Bottom: [Yellow ▾]   │
│  [Use Current Orientation]               │  ← OrientationConfig
├──────────────────────────────────────────┤
│  Move History: U R' F2 D L …            │  ← MoveHistory
├──────────────────────────────────────────┤
│  [▶ Play] [────────●──────] 1.0× [▾]    │
│  Replay: 12.4s solve, 23 moves          │  ← SolveReplayer (shown after solve)
└──────────────────────────────────────────┘
```

---

## 8. Data Flow

```
BLE Device
    │  (raw encrypted BLE packets)
    ▼
GanCubeDriver  (gan-web-bluetooth + decrypt + normalize)
    │  Move | CubeState | Quaternion | ConnectionStatus
    ▼
useCubeDriver  (event emitter)
    ├──▶ useCubeState       → CubeCanvas (face colors)
    ├──▶ useGyro            → CubeCanvas (mesh quaternion)
    ├──▶── useGestureDetector → resetGyro() / resetState()
    └──▶ useSolveRecorder   → SolveReplayer (SolveSession)
```

---

## 9. Future Phases (out of scope now)

- **Phase 2 — Scramble generator:** generates scramble sequence, shows 2D net of scrambled state, highlights completed steps, provides correction sequence on wrong move
- **Phase 3 — Multi-phase timer:** uses move timestamps already captured by `useSolveRecorder`; split points defined by user
- **Phase 4 — Additional cube support:** implement `MoyuCubeDriver`, `QiyiCubeDriver`, etc. behind the same `CubeDriver` interface
