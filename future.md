# Future Work

## On-going, Next
- ~~SolveRecord update - in SolveDetailModal~~

## Known bugs
- ~~cloud sync mode with url into solves or stats-trend~~ — fixed in v1.7
- Roux sometimes CMLL is not corrected detected to be done: https://sansword.github.io/sans_cube/#solve-1775811251412
- [trend stats] - when select range and move mouse out-of-window, it should select the last point but it turns out can't select the range properly because there's no mouse-up triggered to finish the selection

## Solving Methods
- ZZ method support
- ~~allow to update and changes methods of a SolveRecord and calculate its correct phase during update~~

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
- ao5, ao12 for phases?
- filter by driver


## Miscs
- localization
- case detection - OLL, PLL, EO, LR+LU, EP
- scramble optimization: for example, if we have UD pattern, it should be able to turn D and then U.

## Code Quality (Refactor Backlog)
Scanned 2026-04-09. Items #1, #2, #4, #5, #8, #9 done. ~~#10 was a false positive~~ (`bestAo` is not exported and IS used). Remaining:

**#3 — TrendsModal.tsx is 786 lines** (High effort)
- God component: chart data transform + color math + tooltips + controls + all state
- Fix: extract TrendsControls, TrendsChartContainer, color utils to src/utils/colorConversion.ts
- Low priority unless actively working on trends

**#6 — useReplayController.ts `playFrom` is 70 lines** (Low severity, readability only)
- Timing + gyro logic are two independent setup blocks inline in one function
- Fix: extract `startIndicatorAndGyroLoop(startOffsetMs)` helper to make the structure visible

**#7 — TimerScreen.tsx 10 useState declarations** (Low-Medium effort)
- armed, selectedSolve, regeneratePending, sidebarWidth, showHistory, methodFilter, showTrends, sharedSolve, sharedSolveLoading, sharedSolveNotFound
- Best extraction: `useSharedSolve(hash)` for the 3 sharedSolve* fields (clear independent responsibility); leave the rest as-is
- The showHistory/showTrends/selectedSolve triad could be a discriminated union modal state but risks regressions in hash-sync logic

## firebase
- **App Check**: Skip for now. Security rules already lock data to authenticated users — App Check adds a second layer but the main risk is ad blockers silently breaking cloud sync. Worth revisiting if there's real abuse risk or many users. Requires debug token setup for local dev.
- ~~disply id or just a list of number? and when loaing from url, should I still display id?~~