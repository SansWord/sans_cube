# Future Work

## On-going, Next
- SolveRecord update - in SolveDetailModal

## Known bugs
- cloud sync mode with url into solves or stats-trend

## Solving Methods
- ZZ method support
- allow to update and changes methods of a SolveRecord and calculate its correct phase during update

## ~~Hardware Clock~~ — done in v1.52
- ~~when connect hardware, getting its time and identify the difference with wall-clock time. after that, use timestamp from hardware with adjusted difference as clock time. trust time on event instead of Date.now() to calculate overall solving time.~~
- ~~Use cubeTimestamp instead of wall-clock for phase timing (recognitionMs, executionMs)~~
- ~~Implemented via per-solve calibration on first move: `hwOffset = Date.now() - move.cubeTimestamp`, then all timing uses `move.cubeTimestamp + hwOffset`~~

## Hardware
- Support for non-GAN cubes (MoYu, QiYi, etc.)
- Empirical testing for S/E moves

## Replay
- M/S/E moves would make replay jummping and not smooth, also happened in some other cases, not sure what's the root cause.

## Mobile
- should I support touch/mouse for middle slice move?

## Statistic
- ~~separate by method~~ — done in v1.4 (method filter in sidebar, stats derive from filtered pool)
- ~~statistic history trends by phases~~ — done in v1.5 (TrendsModal with Total + Phases tabs)
- ~~for time type toggle - add a toggle to show exec + recog~~ — done in v1.5 (Total/Exec/Recog independently toggleable)
- ~~for phases - allow to hide/show each phases~~ — done in v1.5 (click legend label to hide/show)
- ~~range selection: choose a range and show only that range, with a reset-button~~ — done in v1.5 (drag-to-zoom with multi-level stack, ← Back, Reset zoom)


## Miscs
- localization
- case detection - OLL, PLL, EO, LR+LU, EP
- scramble optimization: for example, if we have UD pattern, it should be able to turn D and then U.

## Code Quality (Refactor Backlog)
Scanned 2026-04-09. Items #1 and #4 done. Remaining:

**#2 — 9x identical move event listener pattern** (Medium effort, Medium impact)
- Every hook/component that handles cube moves duplicates: `d.on('move', fn)` + `d.off('move', fn)` cleanup
- Files: App.tsx, TimerScreen.tsx, useTimer.ts, useCubeState.ts, useSolveRecorder.ts, useScrambleTracker.ts, useGestureDetector.ts
- Fix: extract `useCubeDriverEvent(driver, event, handler)` custom hook

**#3 — TrendsModal.tsx is 786 lines** (High effort)
- God component: chart data transform + color math + tooltips + controls + all state
- Fix: extract TrendsControls, TrendsChartContainer, color utils to src/utils/colorConversion.ts
- Low priority unless actively working on trends

**#5 — useTimer.ts near-identical phase merge blocks** (Medium effort)
- EOLL→OLL and CPLL→EPLL merges are near-duplicate code blocks ~174-204
- Fix: extract helper `absorbPhaseIntoNext(phases, searchLabel, nextLabel, condition)`

**#6 — useReplayController.ts `playFrom` is 70 lines** (Medium effort)
- Timing + gyro logic tangled in one callback
- Fix: separate playback timing from gyro loop

**#7 — TimerScreen.tsx 7 useState declarations** (Low-Medium effort)
- armed, selectedSolve, regeneratePending, sidebarWidth, showHistory, methodFilter, showTrends
- Fix: group related modal state, consider compound state hook

**#8 — CubeRenderer.ts unsafe userData type casts** (Low-Medium effort)
- Multiple `as { x, y, z }` without validation at lines ~155, 175, 261, 390
- Fix: CubieData interface + validate in _buildCubies()

**#9 — useScrambleTracker TrackerState has 8 fields** (Medium effort)
- Makes applyTrackerMove hard to follow
- Fix: discriminated union type for tracker mode

**#10 — `bestAo` in useSolveHistory exported but unused** (Quick win)
- src/hooks/useSolveHistory.ts:65
- Fix: remove export (or delete if truly unused)

## firebase
- **App Check**: Skip for now. Security rules already lock data to authenticated users — App Check adds a second layer but the main risk is ad blockers silently breaking cloud sync. Worth revisiting if there's real abuse risk or many users. Requires debug token setup for local dev.
- ~~disply id or just a list of number? and when loaing from url, should I still display id?~~