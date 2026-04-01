# Scramble Generator + Timer + Solve History — Design Spec

Date: 2026-03-31

## Overview

Add a full timer mode to the GAN cube web app: WCA random-state scramble generation, a live CFOP-phase-aware timer, solve history with statistics, and a solve detail modal with mini-canvas replay.

---

## Layout

The app gains two modes toggled by a button in the connection bar:

- **Debug mode** (current default): existing layout with OrientationConfig, MoveHistory, FaceletDebug
- **Timer mode**: new `TimerScreen` with `SolveHistorySidebar` on the left and main timer area on the right

In timer mode, OrientationConfig, MoveHistory, and FaceletDebug are hidden. The BLE ConnectionBar is simplified to a single connect/disconnect button.

### Timer mode layout

```
┌─────────────────┬──────────────────────────────────┐
│ SolveHistory    │  ScrambleDisplay                 │
│ Sidebar         │  (scramble string, move count)   │
│                 │                                  │
│ Statistics      │  TimerDisplay (XX.XX)            │
│ Solve list      │                                  │
│                 │  CubeCanvas (3D, scrambled state)│
│                 │                                  │
│                 │  PhaseBar                        │
└─────────────────┴──────────────────────────────────┘
```

---

## Scramble Generation

- Library: `cubing.js` (`randomScrambleForEvent("333")`)
- A new scramble is generated after each solve completes and on first entering timer mode
- The scramble is **displayed only** — the user performs it physically on the hardware cube
- The 3D canvas always reflects the live hardware state (no software-applied scramble)
- "New Scramble" button available to regenerate manually

---

## Scramble Tracking

The app monitors hardware moves against the expected scramble sequence and provides live feedback. The cube must be in a solved state before scramble tracking begins.

### `ScrambleStep` shape

```ts
interface ScrambleStep {
  face: Face          // U R F D L B
  direction: 'CW' | 'CCW'
  double: boolean     // true for R2-style moves
}
```

### Step states (rendered inline in `ScrambleDisplay`)

| State | Color | Meaning |
|---|---|---|
| `done` | Green | Step completed correctly |
| `current` | White | Next step to perform |
| `pending` | Dim white | Not yet reached |
| `warning` | Yellow | Right face, wrong execution |
| `wrong` | — | Wrong face moved (sequence hidden) |

### Move matching logic (per hardware move event)

**Expected step is non-double (R or R'):**
- Correct face + correct direction → `done`, advance to next step
- Correct face + wrong direction → `warning`; monitor same face for correction
- Wrong face → `wrong`

**Expected step is double (R2):**
- First turn on correct face (CW or CCW) → partial progress, remember direction
- Second turn on same face, same direction → `done`, advance
- Second turn on same face, opposite direction → cancels; reset partial progress (no warning)
- Turn on wrong face → `wrong`

### Warning state

- Current step highlighted yellow in the scramble sequence
- Two recovery buttons appear: **Reset Cube** (abandon scramble, return to idle) and **Reset Gyro**
- If user performs the correct move on the warned face, warning clears and step completes normally

### Wrong move state

- Scramble sequence is hidden
- Wrong move displayed large in red (e.g. `U`) so user knows exactly what to undo
- App monitors for the reverse move (e.g. `U'`); on receipt, returns to scramble tracking at last good position
- **Reset Cube** button also available to abandon and restart

### Timer arm

- Timer arms automatically when all scramble steps are `done`
- First hardware move after arm starts the timer
- This ensures the cube is in the correct scrambled state before timing begins

---

## Timer Flow

1. **Idle** — scramble displayed, cube at solved state, timer shows `0.00`
2. **Scrambling** — user performs scramble physically; `ScrambleDisplay` highlights progress
3. **Armed** — all scramble steps done; timer ready; display shows "Ready"
4. **Solving** — first move starts the timer
5. **Solved** — cube reaches solved state, timer stops, phase bar populates, solve saved to history
6. **Ready for next** — new scramble generated after a short delay (1s)

---

## Phase Detection — CFOP

Phases are evaluated in order on every `move` event. Each phase becomes active once the prior phase is complete. Transitions are one-way within a solve.

| # | Phase | Detector |
|---|-------|----------|
| 1 | Cross | 4 D-face edges correctly placed and oriented |
| 2 | F2L Slot 1 | First corner-edge pair inserted (any of FR/FL/BR/BL) |
| 3 | F2L Slot 2 | Second corner-edge pair inserted |
| 4 | F2L Slot 3 | Third corner-edge pair inserted |
| 5 | F2L Slot 4 | All 4 corner-edge pairs complete (bottom 2 layers done) |
| 6 | EOLL | All U-face edges oriented (yellow sticker facing up) |
| 7 | OLL | All U-face stickers yellow |
| 8 | CPLL | U-layer corners permuted correctly |
| 9 | Solved | Cube fully solved |

F2L slots are detected in **completion order** — whichever slot finishes first is "Slot 1", regardless of physical position.

Each phase detector is a pure function: `(facelets: string) => boolean`.

### Recognition vs Execution

Within each phase:
- **Recognition** = time from phase activation to the first move in that phase (pause time)
- **Execution** = time from first move to phase completion (turning time)
- Cross has no recognition (starts on first move)

### Extensibility

```ts
interface Phase {
  label: string
  group?: string   // e.g. "F2L" for visual grouping in PhaseBar
  color: string
  isComplete: (facelets: string) => boolean
}

interface SolveMethod {
  id: string
  label: string
  phases: Phase[]
}
```

CFOP is the first `SolveMethod`. Adding ZZ or Roux means defining a new `SolveMethod` with its own phase list — no changes to timer, PhaseBar, or history logic.

---

## Data Shapes

```ts
interface PhaseRecord {
  label: string
  group?: string
  recognitionMs: number
  executionMs: number
  turns: number
  // derived:
  // stepMs = recognitionMs + executionMs
  // tps = turns / (stepMs / 1000)
  // trueTps = turns / (executionMs / 1000)
  // pct = stepMs / solve.timeMs
}

interface SolveRecord {
  id: number           // sequential, 1-indexed
  scramble: string
  timeMs: number       // total solve time in ms
  moves: Move[]        // full move list with timestamps
  phases: PhaseRecord[]
  date: number         // Unix timestamp
}
```

Time display: `(timeMs / 1000).toFixed(2)` → `"23.63"`

TPS variants:
- **TPS** = total turns ÷ total time (seconds)
- **True TPS** = total turns ÷ total execution time (seconds)

---

## Components

### `ScrambleDisplay`
Shows the scramble sequence inline with per-step color coding (`done`=green, `current`=white, `pending`=dim, `warning`=yellow). In `wrong` state, hides the sequence and shows the offending move large in red. Reset Cube and Reset Gyro buttons appear during `warning` and `wrong` states.

### `TimerDisplay`
Large centered `XX.XX` seconds. Color changes: white during solving, green on solved.

### `PhaseBar`
Horizontal bar divided into 9 colored segments proportional to each phase's time.

- F2L slots share a color family (4 shades of one color) to show grouping
- Hover tooltip per segment shows:
  - Phase label
  - Total Time, Recognition, Execution (seconds, 2dp)
  - TPS, True TPS
  - Turns
  - Percentage of total
  - If hovering any F2L slot: F2L group totals section below (Total Time, Total Recognition, Total Execution, Total TPS, Total True TPS, Total Turns, Percentage)

### `SolveHistorySidebar`

**Statistics table:**

| | Current | Best |
|---|---|---|
| Single | 23.63 | 19.56 |
| Ao5 | 24.53 | 21.07 |
| Ao12 | 24.28 | 22.05 |
| Ao100 | 24.15 | 23.88 |

**Solve list:** scrollable, columns — `#`, `Time`, `TPS`. Clicking a row opens the `SolveDetailModal`.

### `SolveDetailModal`

Full-screen modal, triggered by clicking a solve in the sidebar list.

**Header:** "Solve #671" + close button (×)

**General Statistics row:** Time | Turns | TPS | Date

**Scramble row:** scramble string + copy-to-clipboard icon + "Use this scramble" button (loads scramble into timer mode)

**Body — two columns:**

Left — **Replay:**
- Gyro toggle (applies gyro orientation to mini canvas)
- Speed selector (×0.5, ×1, ×2)
- Mini `CubeCanvas` (separate `CubeRenderer` instance, does not affect main canvas)
- Playback controls: `<<` (start) `<` (prev move) `>` (next move/play) `>>` (end)
- Current phase label + `3.07s / 23.63s` progress
- Scrub bar (seek by time)

Right — **Detailed Analysis:**
- Method label: "CFOP"
- Table columns: Step | Recognition | Execution | Step | Total | Turns
- Total row: sum of recognition (with %), sum of execution (with %), total time, total time, total turns
- One row per phase: label, recognition (s), execution (s), step time (s), cumulative time (s), turns
- Cross recognition shown as `—`

**Bottom left:** Time Distribution bar (same PhaseBar, non-interactive)

**Bottom right:** `Delete` button (removes solve from history after confirmation)

---

## `useSolveHistory` Hook

- Persists `SolveRecord[]` to `localStorage` key `"sans_cube_solves"`
- Exposes: `solves`, `addSolve`, `deleteSolve`
- Computes statistics on demand: single (latest), Ao5, Ao12, Ao100 — current (latest N) and best (best rolling window)
- Ao5/12/100 drop best and worst (standard WCA rules) when N ≥ 5

---

## `useScramble` Hook

- Calls `cubing.js` `randomScrambleForEvent("333")` asynchronously
- Parses the scramble string into `ScrambleStep[]`
- Returns `{ scramble: string, steps: ScrambleStep[], regenerate: () => void }`
- No facelets manipulation — the 3D canvas always shows live hardware state

## `useScrambleTracker` Hook

- Accepts `steps: ScrambleStep[]` and subscribes to `driver.on('move')`
- Tracks current step index and partial progress on double moves
- Returns `{ stepStates, trackingState, reset }` where:
  - `stepStates: Array<'done' | 'current' | 'pending' | 'warning'>` — one per step
  - `trackingState: 'scrambling' | 'warning' | 'wrong' | 'armed'`
  - `wrongMove: Move | null` — the offending move when in `wrong` state
- Emits `onArmed` callback when all steps complete (timer can arm)

---

## `useTimer` Hook

- State machine: `idle → solving → solved`
- Tracks: `startTime`, `elapsedMs`, per-phase split timestamps, per-phase move counts
- Subscribes to `driver.on('move')` to detect first move (start) and monitors `isSolved` to detect completion
- Returns: `{ state, elapsedMs, phases: PhaseRecord[], start, stop, reset }`

---

## What is hidden in timer mode

| Element | Timer mode |
|---|---|
| ConnectionBar | Simplified to connect/disconnect button only |
| ControlBar | Hidden (gestures U×4 / D×4 still active) |
| OrientationConfig | Hidden |
| MoveHistory | Hidden |
| FaceletDebug | Hidden |
| SolveReplayer | Replaced by SolveDetailModal |

---

## Out of scope (v0.2)

- OLL/PLL case detection
- Sessions
- Share / export
- +2 / DNF penalties
- Cube name / device identity
- Non-CFOP methods (interface is ready, no UI to switch)
