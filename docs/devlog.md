# Dev Log — sans_cube

A record of what was built and what was learned, especially around co-working with Claude Code.

---

## v1.3 — Firebase Cloud Sync (2026-04-08)

**What was built:**
- Opt-in cloud sync via Firebase Firestore, toggled from the debug section
- Google Sign-In with per-user data isolation
- One-time migration of localStorage solves to Firestore on first enable
- GitHub Actions deploy workflow for GitHub Pages

**Learnings — Firebase:**
- Firebase web API keys are not secrets — security comes from Firestore rules, not the key
- `authDomain` should always be the Firebase-provided domain (`*.firebaseapp.com`), not your hosted domain
- Firebase Auth automatically whitelists `localhost` — no config needed for local dev
- Firestore rejects `undefined` values (only accepts `null`) — always sanitize objects before writing with `JSON.parse(JSON.stringify(obj))`
- `npm ci` in CI fails when `package-lock.json` was generated on macOS (Linux-specific optional native packages like `@emnapi/*` are missing) — use `npm install` instead in the workflow

**Learnings — Claude Code workflow:**
- Subagent-driven development (brainstorm → write plan → execute with subagents) produced high-quality, reviewed code with no surprises
- Asking Claude to scan git log and deduce learning is a fast way to populate a devlog retroactively
- CLAUDE.md doc index (`docs/firebase-cloud-sync.md`) is better than loading docs eagerly — Claude reads only what's relevant per session

---

## v1.2 — Mobile & Polish (2026-04-06)

**What was built:**
- Full mobile touch support for CubeCanvas (drag to rotate)
- Mobile layout for TimerScreen with overlay sidebar
- Sticky solve detail header and replay section on mobile
- Phase bar touch handling (tooltip stays visible after lift)
- LinkedIn and GitHub attribution links
- Various mobile CSS fixes (overflow, font size, text wrapping)

**Learnings:**
- Mobile touch events require careful handling of `touchAction` and empty touch list guards
- Sticky positioning inside scroll containers requires specific CSS structure
- Small UI polish (attribution, font size, wrapping) takes more commits than expected

---

## v1.1 — Roux Method + Slice Moves (2026-04-03 to 2026-04-05)

**What was built:**
- Roux method phase detection (FB, SB, CMLL, LSE)
- Roux facelet detection utilities with tests
- Method selector dropdown, persisted to localStorage
- `SliceMoveDetector` middleware for M/E/S move detection
- Broadened `Move.face` type to include `SliceFace` and `AnyFace`
- Retroactive slice move correction with `cubeTimestamp`-gated pairing

**Learnings:**
- Slice moves (M/E/S) require middleware that infers the move from two sequential face moves — they're not directly reported by the GAN protocol
- Adding a new solve method requires: detection utils → `SolveMethod` definition → hook integration → UI selector — a clear layered pattern
- Phase detection bugs are best caught by comparing against known solve recordings
- `cubeTimestamp` (hardware clock) vs wall clock distinction matters when pairing slice moves retroactively

---

## v1.0 — Scramble Tracker + Timer + Solve History (2026-03-31 to 2026-04-02)

**What was built:**
- Full CFOP timer with phase detection (Cross, F2L ×4, OLL, PLL)
- Scramble tracker state machine — verifies cube matches generated scramble before starting timer
- Wrong-move cancellation hints with net-turn tracking
- Solve history sidebar with Ao5/Ao12/Ao100 statistics
- Solve detail modal with mini canvas replay and phase breakdown
- PhaseBar with hover tooltip and F2L grouping
- `useScramble`, `useScrambleTracker`, `useTimer`, `useSolveHistory` hooks
- Example solves with dismissable cards

**Learnings — architecture:**
- State machines are the right model for scramble verification — tracking states (idle → scrambling → armed → solving → solved) prevents edge cases
- Separating "recognition time" from "execution time" per phase requires careful timestamp handling
- Sequential solve IDs need to be persisted independently of the solve list (counter survives deletes)

**Learnings — Claude Code workflow:**
- The brainstorm → design spec → implementation plan → execute pipeline produced a clean, well-tested feature with clear scope
- TDD (write failing test first, then implement) caught several edge cases in `computeAo` and phase detection
- Superpowers skills (brainstorming, writing-plans, executing-plans) provide consistent structure across sessions

---

## v0.4 — Example Solves + Button Driver (2026-03-30)

**What was built:**
- Example solve records with negative IDs (won't conflict with real solves)
- Button driver for controlling a virtual cube without hardware
- Anchor URLs for solve detail modal (`#solve-<id>`)
- Replaced `cubing.js` WASM scrambler with a simpler random-move generator (removed heavy dependency)

**Learnings:**
- WASM dependencies (like `cubing.js`) add significant bundle size and complexity — a simple random-move generator was sufficient for the use case
- Negative IDs for example records is a clean way to distinguish them without a separate type field

---

## v0.3 — Replay + Phase Highlighting (2026-03-28)

**What was built:**
- Smooth gyro-interpolated replay of recorded solves
- Phase highlighting in the replay timeline
- CFOP phase grouping (F2L pairs grouped visually)
- Battery indicator with polling
- Draggable sidebar with proportional font scaling

**Learnings:**
- Quaternion interpolation (SLERP) is needed for smooth gyro replay — linear interpolation produces jerky rotation
- Replay requires a separate timestamp system (`cubeTimestamp` from hardware) vs wall clock to be accurate
- CSS `resize` for a draggable sidebar is simpler than a drag handler but less controllable

---

## v0.2 — Layout + Sidebar (2026-03-27)

**What was built:**
- Timer/debug mode toggle
- Solve history sidebar with resizable width (persisted)
- Scramble display with per-step color coding
- Sidebar statistics (single, Ao5, Ao12, Ao100)

**Learnings:**
- `localStorage` persistence of UI state (sidebar width, mode) makes the app feel polished with minimal effort
- Ao calculation with trimming (drop best/worst) requires careful index handling for edge cases (n ≤ 4)

---

## v0.1 — Foundation (2026-03-25 to 2026-03-26)

**What was built:**
- Vite + React + TypeScript scaffold
- `CubeDriver` abstract interface + `GanCubeDriver` wrapping `gan-web-bluetooth`
- `useCubeDriver`, `useCubeState`, `useGyro`, `useGestureDetector`, `useSolveRecorder` hooks
- Three.js `CubeRenderer` with layer animation
- `CubeCanvas`, `ConnectionBar`, `OrientationConfig`, `MoveHistory` components
- 2D facelet debug view
- GitHub Actions CI + GitHub Pages deploy (Node version matching was first CI lesson)

**Learnings — BLE + GAN protocol:**
- Web Bluetooth only works in Chromium (Chrome/Edge) — not Firefox or Safari
- GAN Gen4 protocol uses AES encryption — `gan-web-bluetooth` handles this, but the cube must be in the right mode
- Face sticker cycles and orientation conventions (green front / yellow bottom) must be established early — they affect everything downstream
- `cubeTimestamp` from hardware is separate from wall clock and drifts — important for replay accuracy

**Learnings — Claude Code workflow:**
- Starting with a design spec (phase 1 spec) before any code gave Claude clear constraints and avoided scope creep
- Hooks-based architecture (`useCubeDriver`, `useCubeState`, etc.) maps well to the event-driven BLE model
- CI failures early (Node version, `npm ci` vs `npm install`) are cheaper to fix than later
