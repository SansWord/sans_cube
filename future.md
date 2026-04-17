# Future Work

## On-going, Next

## Known bugs
- ~~cloud sync mode with url into solves or stats-trend~~ — fixed in v1.7
- ~~[trend stats] - when select range and move mouse out-of-window, it should select the last point but it turns out can't select the range properly because there's no mouse-up triggered to finish the selection~~ — fixed in v1.13

## Solving Methods
- ZZ method support
- ~~allow to update and changes methods of a SolveRecord and calculate its correct phase during update~~
- Roux sometimes CMLL is not corrected detected to be done: https://sansword.github.io/sans_cube/#solve-1775811251412 - this is not a bug, but how flexible we want it to treat CMLL is done: if the only difference is U moves, should we think CMLL is done?
- **CFOP phase detection breaks with middle-slice moves** — CFOP algorithms (OLL, PLL, F2L insertions) occasionally use M/E/S moves (e.g. Niklas, some PLL algs). The current CFOP phase detector only tracks outer-face moves and will misidentify phase boundaries when a solver uses any slice move during a CFOP solve. Needs investigation: either teach CFOP phase detection about slice moves, or flag affected solves.

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
- TrendsModal.tsx refactor (786 lines) — god component: chart data transform + color math + tooltips + controls + all state. Consider when actively working on trends features.


## Miscs
- localization
- case detection - OLL, PLL, EO, LR+LU, EP
- scramble optimization: for example, if we have UD pattern, it should be able to turn D and then U.

## URL / Routing
- **hashchange handler audit** — the app currently has multiple independent `hashchange` listeners spread across `App.tsx`, `TimerScreen.tsx`, `useSharedSolve.ts`, and `TrendsModal.tsx`. Worth auditing how many there are and exploring whether they should be consolidated into a single router or at least a shared hook. Deferred while M-move migration is in progress.

## Code Quality (Refactor Backlog)
- **Promote `PositionMove` and retire the `Move` alias** — Phase 3 introduces `PositionMove` as the canonical name for position-based moves, with `Move` kept as a backward-compat alias. A follow-up session should replace all existing `Move` usages with `PositionMove` and delete the alias. Do as a standalone mechanical rename session (~20+ files).


Scanned 2026-04-09. Items #1, #2, #4, #5, #8, #9 done. ~~#10 was a false positive~~ (`bestAo` is not exported and IS used). Remaining:

~~**#3 — TrendsModal.tsx is 786 lines**~~ — moved to Statistic section

**~~#6 — useReplayController.ts `playFrom` is 70 lines~~** — skipped; not worth it. The only extract with real value (`scheduleMoves` as a pure function) has low ROI since this code isn't changing. Cosmetic inner-function rename doesn't improve understandability enough to justify the churn.

**~~#7 — TimerScreen.tsx 10 useState declarations~~** — done in v1.13 (`useSharedSolve` extracted)

## firebase
- **App Check**: Skip for now. Security rules already lock data to authenticated users — App Check adds a second layer but the main risk is ad blockers silently breaking cloud sync. Worth revisiting if there's real abuse risk or many users. Requires debug token setup for local dev.
- ~~disply id or just a list of number? and when loaing from url, should I still display id?~~