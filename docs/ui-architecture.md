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
    │   ├── SolveDetailModal         ← overlay when a mismatch solve is selected
    │   │   ├── PhaseBar
    │   │   └── CubeCanvas
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
            ├── SolveDetailModal     ← rendered when a solve is selected (can overlay TrendsModal)
            └── SolveDetailModal     ← rendered in read-only mode when #shared-{shareId} is open
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

**Debug-mode solve editing state (App-level):**
- `selectedDebugSolve: SolveRecord | null` — solve currently open in the debug-mode `SolveDetailModal` overlay
- `methodMismatches: MethodMismatch[] | null` — results from the method mismatch detector; `null` means not yet run
- `handleDebugUpdate` — writes updated solve to localStorage or Firestore directly (bypasses `useSolveHistory`); re-checks the updated solve against `methodMismatches` and removes or updates the entry
- `handleDebugDelete` — deletes solve from storage, closes modal, removes entry from `methodMismatches`

Note: `TimerScreen` is unmounted while debug mode is active, so direct storage writes from `App` are picked up cleanly when timer mode is next opened.

### `TimerScreen` (`src/components/TimerScreen.tsx`)

| Hook | Provides |
|---|---|
| `useSolveHistory` | `solves`, `addSolve`, `deleteSolve`, `updateSolve`, `nextSolveIds`, `cloudLoading` |
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

Local state: `localSolve` (mirrors the `solve` prop, updated optimistically on method change), `saving` (disables `MethodSelector` and Delete during async save), `methodError` (inline error shown if phase recompute fails or save times out), `savedConfirmation` (shows "Saved ✓" for 2 seconds after a successful save). All other state (facelets at a given index, phase label, cancelled-move detection) is computed locally via pure functions (`computeFaceletsAtIndex`, `getPhaseLabelAtIndex`).

Props: `onUpdate`, `onDelete`, `onShare?`, `onUnshare?`, `readOnly?` — `onShare`/`onUnshare` are only passed when cloud sync is enabled and the user is signed in. When `readOnly` is true (viewer mode), all action controls (delete, share, copy-as-example) are hidden.

Rendered in three contexts: inside `TimerScreen` (timer mode, editable), directly in `App` (debug mode — opened from the method mismatch detector results list), and in viewer mode when `#shared-{shareId}` is open (read-only).

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
| `firestoreSharing.ts` | Share ID generation (`newShareId`), and Firestore CRUD for `public_solves/{shareId}` and `users/{uid}/shared_solves/{shareId}` |

---

## Rendering (`src/rendering/`)

`CubeRenderer` (`src/rendering/CubeRenderer.ts`) owns the Three.js scene, camera, and animation loop. `CubeCanvas` creates one instance on mount and exposes it via the `onRendererReady` callback. Components that need to drive animation (e.g. replay) hold a `ref` to the renderer and call `animateMove()` directly.
