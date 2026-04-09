# UI Architecture

Component tree, hook ownership, and data flow for sans_cube.

## Component Tree

```
main.tsx
└── App
    ├── ConnectionBar
    ├── [debug mode]
    │   ├── ControlBar
    │   ├── CubeCanvas
    │   ├── OrientationConfig
    │   ├── FaceletDebug
    │   ├── MoveHistory
    │   └── SolveReplayer            ← shown after a solve completes
    └── [timer mode]
        └── TimerScreen
            ├── SolveHistorySidebar  ← desktop sidebar (always rendered)
            ├── ScrambleDisplay
            ├── TimerDisplay
            ├── CubeCanvas
            ├── MethodSelector
            ├── PhaseBar
            ├── SolveHistorySidebar  ← mobile overlay (rendered when showHistory=true)
            ├── TrendsModal          ← rendered when showTrends=true
            └── SolveDetailModal     ← rendered when a solve is selected (can overlay TrendsModal)
                ├── PhaseBar
                └── CubeCanvas
```

---

## Hook Ownership

Each hook is owned by a single component; data flows down as props.

### `App` (`src/App.tsx`)

| Hook | Provides |
|---|---|
| `useCubeDriver` | `driver`, `connect`, `disconnect`, `status`, `driverType`, `switchDriver`, `driverVersion` |
| `useCubeState` | `facelets`, `isSolved`, `isSolvedRef`, `resetState` |
| `useGyro` | `quaternion`, `config`, `resetGyro`, `saveOrientationConfig` |
| `useSolveRecorder` | `lastSession`, `clearSession` (debug-mode replay) |
| `useCloudSync` | `user`, `enabled`, `enable`, `disable`, `signIn`, `signOut`, `authLoading` |
| `useGestureDetector` | side-effect only — fires `resetGyro` / `resetState` on U×4 / D×4 |

`App` subscribes to `driver` move events directly (for `rendererRef` animations in debug mode and for populating `moves` state shown in `MoveHistory`).

### `TimerScreen` (`src/components/TimerScreen.tsx`)

| Hook | Provides |
|---|---|
| `useSolveHistory` | `solves`, `addSolve`, `deleteSolve`, `nextSolveIds`, `cloudLoading` |
| `useScramble` | `scramble`, `steps`, `regenerate`, `load` |
| `useScrambleTracker` | `stepStates`, `trackingState`, `wrongSegments`, `reset` |
| `useTimer` | `status`, `elapsedMs`, `phaseRecords`, `recordedMoves`, `quaternionSnapshots`, `reset` |
| `useMethod` | `method`, `setMethod` |
| `methodFilter` / `setMethodFilter` | Lifted MethodFilter state — shared between sidebar and TrendsModal |
| `showTrends` / `setShowTrends` | Controls TrendsModal visibility |

`TimerScreen` receives `driver`, `facelets`, `quaternion`, `driverType`, and the reset callbacks from `App` as props. It owns its own `rendererRef` for animating moves in timer mode.

### `SolveDetailModal` (`src/components/SolveDetailModal.tsx`)

| Hook | Provides |
|---|---|
| `useReplayController` | `currentIndex`, `indicatorMs`, `isPlaying`, `speed`, `gyroEnabled`, `play`, `pause`, `seekTo`, `stepForward`, `stepBackward`, `fastForward`, `fastBackward`, `setSpeed`, `setGyroEnabled` |

All other state (facelets at a given index, phase label, cancelled-move detection) is computed locally via pure functions (`computeFaceletsAtIndex`, `getPhaseLabelAtIndex`).

### `SolveReplayer` (`src/components/SolveReplayer.tsx`)

Debug-mode only. Owns its own playback state (`isPlaying`, `currentIndex`, `speed`) via `useState`. Drives the **existing** `CubeRenderer` instance passed down as a prop — it does not mount its own `CubeCanvas`.

### `SolveHistorySidebar` (`src/components/SolveHistorySidebar.tsx`)

No custom hooks. Local `useState` for the method filter. Calls `computeStats` (exported from `useSolveHistory`) to derive statistics from the `solves` array it receives as a prop. Renders in two modes depending on whether `onClose` is provided: desktop sidebar or mobile full-screen overlay.

---

## Leaf / Display Components

These components are purely presentational — they receive data as props and fire callbacks.

| Component | Props in | Callbacks out |
|---|---|---|
| `ConnectionBar` | `status`, `battery`, `mode`, `driverType` | `onConnect`, `onDisconnect`, `onToggleMode`, `onSwitchDriver` |
| `ControlBar` | `disabled` | `onResetGyro`, `onResetState` |
| `CubeCanvas` | `facelets`, `quaternion`, `interactive`, `style` | `onRendererReady`, `onResetOrientation`, `onOrbit`, `onMove` |
| `TimerDisplay` | `elapsedMs`, `status`, `armed` | — |
| `ScrambleDisplay` | `scramble`, `steps`, `stepStates`, `trackingState`, `wrongSegments`, `regeneratePending` | `onRegenerate`, `onResetCube`, `onResetGyro`, `onAutoScramble` |
| `PhaseBar` | `phaseRecords`, `method`, `interactive`, `indicatorPct` | — |
| `MethodSelector` | `method`, `disabled` | `onChange` |
| `OrientationConfig` | `config`, `disabled` | `onSave`, `onUseCurrentOrientation` |
| `MoveHistory` | `moves` | — |
| `FaceletDebug` | `facelets` | — |
| `SolveHistorySidebar` | `solves`, `width`, `cloudLoading`, `methodFilter`, `setMethodFilter`, `onOpenTrends` | `onSelectSolve`, `onWidthChange`, `onClose` |
| `TrendsModal` | `solves`, `methodFilter`, `setMethodFilter`, `onSelectSolve`, `onClose` | — |

---

## Drivers (`src/drivers/`)

| File | Role |
|---|---|
| `CubeDriver.ts` | Abstract EventEmitter interface all drivers implement (`move`, `gyro`, `battery` events) |
| `GanCubeDriver.ts` | BLE connection to real GAN cubes (via `gan-web-bluetooth`) |
| `MouseDriver.ts` | Simulates cube moves via mouse drag on `CubeCanvas`; exposes `sendMove()` |
| `ButtonDriver.ts` | Simulates cube moves via button clicks |
| `SliceMoveDetector.ts` | Converts raw face moves to slice notation (M/E/S) |

---

## Services (`src/services/`)

| File | Role |
|---|---|
| `firebase.ts` | Firebase app init; exports `auth`, `db`, `googleProvider` |
| `firestoreSolves.ts` | Firestore CRUD for solve records (`users/{uid}/solves`) and sequence counter (`users/{uid}/meta/counter`) |

---

## Rendering (`src/rendering/`)

`CubeRenderer` (`src/rendering/CubeRenderer.ts`) owns the Three.js scene, camera, and animation loop. `CubeCanvas` creates one instance on mount and exposes it via the `onRendererReady` callback. Components that need to drive animation (e.g. replay) hold a `ref` to the renderer and call `animateMove()` directly.
