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
    │   └── AcubemyImportModal      ← overlay when "Import from acubemy" is clicked
    ├── AnalyticsBanner              ← fixed-position bottom overlay, no props, one-time dismiss
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

## Stores

Module-level singletons held outside the React tree. Consumers subscribe via dedicated hooks.

- `src/stores/solveStore.ts` — single source of truth for the signed-in user's solves. Owns `solves`, `dismissedExamples`, `status`, `error`, `cloudReady`. `App` drives `solveStore.configure(cloudConfig)` in an effect; every consumer reads via `useSolveStore()`. CRUD methods are optimistic with rollback on Firestore errors. `addMany()` chunks writes by 100 via `Promise.allSettled`. `runBulkOp()` wraps server-side maintenance ops and reloads afterward.

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
- `handleDebugUpdate` — delegates to `solveStore.updateSolve`; re-checks the updated solve against `methodMismatches` and removes or updates the entry
- `handleDebugDelete` — delegates to `solveStore.deleteSolve`, closes modal, removes entry from `methodMismatches`

Note: because `solveStore` is a module-level singleton, updates made in debug mode are immediately visible when timer mode is next opened (no re-fetch needed).

**Debug panels (`App`-level):**
- **`DebugPanel`** — presentational shell for debug panels: box/title/warning chrome, disabled dimming with hint. Exports `buttonStyle` helper. No state.
- **`RecomputePhasesPanel`** — debug panel for scanning and committing phase recomputation. Props: `targetLabel`, `loadSolves`, `commitChanges`, `onSolveClick`. State machine: `idle → scanning → results → committing → committed`.
- **`ResequenceScopePanel`** — debug panel for previewing and committing Firestore `seq` renumber. Props: `disabled`, `loadSolves`, `commit`. State machine: `idle → ready → committing → committed`. Uses `DebugPanel`, `previewRenumberScope`, `buttonStyle`.

### `TimerScreen` (`src/components/TimerScreen.tsx`)

| Hook | Provides |
|---|---|
| `useSolveStore` | `solves`, `addSolve`, `deleteSolve`, `updateSolve`, `nextSolveIds`, `cloudLoading` (derived from `status === 'loading'`) |
| `useScramble` | `scramble`, `steps`, `regenerate`, `load` |
| `useScrambleTracker` | `stepStates`, `trackingState`, `wrongSegments`, `reset` |
| `useTimer` | `status`, `elapsedMs`, `phaseRecords`, `recordedMoves`, `quaternionSnapshots`, `reset` |
| `useMethod` | `method`, `setMethod` |
| `useSharedSolve` | `sharedSolve`, `sharedSolveLoading`, `sharedSolveNotFound`, `clearSharedSolve` |
| `solveFilter` / `updateSolveFilter` | Lifted `SolveFilter` state (`{ method, driver }`) — shared between sidebar and TrendsModal; persisted to `sans_cube_method_filter` and `sans_cube_driver_filter` in localStorage; URL hash `method`/`driver` params override localStorage when opening Trends |
| `showTrends` / `setShowTrends` | Controls TrendsModal visibility |

`TimerScreen` receives `driver`, `facelets`, `quaternion`, `driverType`, and the reset callbacks from `App` as props. It owns its own `rendererRef` for animating moves in timer mode.

### `SolveDetailModal` (`src/components/SolveDetailModal.tsx`)

| Hook | Provides |
|---|---|
| `useReplayController` | `currentIndex`, `indicatorMs`, `isPlaying`, `speed`, `gyroEnabled`, `play`, `pause`, `seekTo`, `stepForward`, `stepBackward`, `fastForward`, `fastBackward`, `setSpeed`, `setGyroEnabled` |

Local state: `localSolve` (mirrors the `solve` prop, updated optimistically on method change), `saving` (disables `MethodSelector` and Delete during async save), `methodError` (inline error shown if phase recompute fails or save times out), `savedConfirmation` (shows "Saved ✓" for 2 seconds after a successful save). All other state (facelets at a given index, phase label, cancelled-move detection) is computed locally via pure functions (`computeFaceletsAtIndex`, `getPhaseLabelAtIndex`).

Props: `onUpdate`, `onDelete`, `onShare?`, `onUnshare?`, `readOnly?` — `onShare`/`onUnshare` are only passed when cloud sync is enabled and the user is signed in. When `readOnly` is true (viewer mode), all action controls (delete, share, copy-as-example) are hidden. When the solve has `importedFrom` set, a small "Imported from {source}" pill renders next to the title in the header (provenance label only — no action).

Rendered in three contexts: inside `TimerScreen` (timer mode, editable), directly in `App` (debug mode — opened from the method mismatch detector results list), and in viewer mode when `#shared-{shareId}` is open (read-only).

### `AcubemyImportModal` (`src/components/AcubemyImportModal.tsx`)

| Prop | Description |
|---|---|
| `open` | Whether the modal is visible |
| `onClose` | Close handler |
| `existingSolves` | Current solve list (for dedup + max-seq calculation) |
| `cloudConfig` | `CloudConfig` at modal-open time; target is re-checked at commit |
| `onCommit` | `(drafts: SolveRecord[]) => Promise<void>` — writes the new drafts via the parent's storage path |

### `SolveHistorySidebar` (`src/components/SolveHistorySidebar.tsx`)

No custom hooks. Calls `computeStats` and `filterSolves` (both exported from `src/utils/solveStats.ts`) to derive statistics from the `solves` array it receives as a prop. Renders in two modes depending on whether `onClose` is provided: desktop sidebar or mobile full-screen overlay.

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
| `SolveHistorySidebar` | `solves`, `width`, `cloudLoading`, `solveFilter`, `updateSolveFilter`, `onOpenTrends` | `onSelectSolve`, `onWidthChange`, `onClose` |
| `TrendsModal` | `solves`, `solveFilter`, `updateSolveFilter`, `onSelectSolve`, `onClose`, `initialParams` | — |

**TrendsModal local state:** `sortMode` (URL-synced via `initialParams.sortMode`, controls solve display order by sequence or completion date)

---

## Shared Hooks (`src/hooks/`)

| Hook | Role |
|---|---|
| `useCubeDriverEvent(driver, event, handler, driverVersion?)` | Registers a typed event handler on a `CubeDriver` and cleans it up on unmount or driver reconnect. Uses a handler ref internally — no `useCallback` required at call sites. Used by every hook/component that listens to cube events. |

---

## Drivers (`src/drivers/`)

| File | Role |
|---|---|
| `CubeDriver.ts` | Abstract EventEmitter interface all drivers implement (`move`, `gyro`, `battery` events) |
| `GanCubeDriver.ts` | BLE connection to real GAN cubes (via `gan-web-bluetooth`) |
| `MouseDriver.ts` | Simulates cube moves via mouse drag on `CubeCanvas`; exposes `sendMove()` |
| `ButtonDriver.ts` | Simulates cube moves via button clicks |
| `ColorMoveTranslator.ts` | Translates GAN color-based move events to geometric face labels; detects M/E/S via center tracking |

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
