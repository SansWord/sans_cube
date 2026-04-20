# Future Work

## On-going, Next

## Investigate
- **Save a shared solve into own history** — shared solve at `#shared-F8x2wwtsSuv3I5NEqdNA` needs to be importable into localStorage or Firestore. Currently shared solves are view-only with no way to copy them into your own solve list.

## Known bugs
- ~~cloud sync mode with url into solves or stats-trend~~ — fixed in v1.7
- ~~[trend stats] - when select range and move mouse out-of-window, it should select the last point but it turns out can't select the range properly because there's no mouse-up triggered to finish the selection~~ — fixed in v1.13

## adjustable session
- a session separations - create, rename sessions, put solves into a seesion, session stats, trends.

## Solving Methods
- ~~add a "freeform" method that only has one cube-is-solved phase. we can use this for future preparation. method filter should support this for record list and stats~~ — done in v1.22.0
- ZZ method support
- ~~allow to update and changes methods of a SolveRecord and calculate its correct phase during update~~
- ~~Roux sometimes CMLL is not corrected detected to be done: https://sansword.github.io/sans_cube/#solve-1775811251412 - this is not a bug, but how flexible we want it to treat CMLL is done: if the only difference is U moves, should we think CMLL is done?~~ — done in v1.24.1 (`isCMLLDone` now uses pair-equality checks instead of hardcoded W, so AUF-only differences pass)
- ~~**CFOP phase detection breaks with middle-slice moves** — CFOP algorithms (OLL, PLL, F2L insertions) occasionally use M/E/S moves (e.g. Niklas, some PLL algs). The current CFOP phase detector only tracks outer-face moves and will misidentify phase boundaries when a solver uses any slice move during a CFOP solve. Needs investigation: either teach CFOP phase detection about slice moves, or flag affected solves.~~ — done in v1.24.0 / v1.24.1 (CFOP and Roux `isDone` predicates now tolerate M/E/S center drift and whole-cube rotations)

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
- ~~filter by driver~~ — done in v1.15.0 (driver filter in sidebar + Trends, persisted and URL-honoring)
- TrendsModal.tsx refactor (786 lines) — god component: chart data transform + color math + tooltips + controls + all state. Consider when actively working on trends features.
- **Sort-by-timestamp toggle in Trends** — normalize the backward time-jump in the chart after an import by offering a sort mode that orders by cubeTimestamp instead of solve seq.


## Import
- **Re-import / update for records with warning state** — currently `gyro-dropped` rows import without gyro data and stay that way. Allow re-running import on a fresh export to recover dropped fields. Needs design: overwrite vs merge vs diff.

## Miscs
- localization
- case detection - OLL, PLL, EO, LR+LU, EP
- ~~scramble optimization: for example, if we have UD pattern, it should be able to turn D and then U.~~ - v1.21.1

## URL / Routing
- ~~**hashchange handler audit** — the app currently has multiple independent `hashchange` listeners spread across `App.tsx`, `TimerScreen.tsx`, `useSharedSolve.ts`, and `TrendsModal.tsx`. Worth auditing how many there are and exploring whether they should be consolidated into a single router or at least a shared hook. Deferred while M-move migration is in progress.~~ — done in v1.20.0 (`useHashRouter` consolidates all listeners; typed `Route` union; `pushState`/`replaceState` write-back strategy)

## Schema
- **Verify acubemy ↔ sans_cube quaternion reference frame equivalence** — follow-up validation task, not part of the acubemy import implementation. The importer ships under the assumption that both systems store raw sensor quaternions from the same hardware and therefore share a reference frame. Code inspection supports this (sans_cube: `GanCubeDriver.ts:79-82` → `useTimer.ts:131-134`, no transform before storage; acubemy's data shows well-formed unit quaternions with natural non-identity starting orientations consistent with raw sensor values), but this is inference, not proof. Verify empirically in a later session: record the same physical solve through both systems (or hold the cube in the same orientation and compare a snapshot), then confirm the stored quaternions match within sensor noise. If frames differ, add a quaternion transform step to the importer in a follow-up.

- **Shorten `SolveRecord` field names and drop the 10 Hz gyro downsample cap** — two related storage-and-fidelity improvements that would ship together as `schemaVersion: 3`.
  1. **Shorten field names.** Acubemy uses short keys (`q`, `t`); ours are long (`quaternion`, `relativeMs`, `cubeTimestamp`, `direction`, `scramble`, `timeMs`, etc.). Each key repeats per move and per gyro sample. Measured on acubemy's sample data: ~27% per-sample savings from shorter keys alone. Tradeoff: readability in raw JSON drops.
  2. **Stop downsampling gyro.** `useTimer.ts` currently caps gyro storage at 10 Hz via a 100ms throttle. The cube emits ~22 Hz (paired-sample BLE packets every ~90ms). We're discarding ~half of what the hardware provides, which makes our replays noticeably less smooth than acubemy's. Removing the cap captures the full stream.
  - **Net impact**: per-second gyro storage stays roughly flat — shorter keys compensate for the doubled sample count. Measured projection: ~1.4 KB/s (matches acubemy exactly; today we're at ~0.82 KB/s with 10 Hz sampling + long names).
  - **Requires** a v2→v3 migration path on load, a key mapping table, migration tests, and a decision on whether `importedFrom` and other optional fields also get shortened. Design carefully.

## Code Quality (Refactor Backlog)

**Effect deps: move guards to refs in URL write effects** — The "trigger vs. reader" principle: effect deps should only contain values whose changes should re-run the effect. Values used only as guards (`if (x) return`) belong in refs, not deps. Two guards are still in deps:
- `sharedSolve` and `sharedSolveLoading` in the selectedSolve URL write effect
- `showTrends` in the sharedSolve URL write effect (already using `showTrendsRef` in the selectedSolve effect — apply same pattern here)
No active bugs, but same failure mode as the v1.20.1 `showTrends` bug: if a guard value changes while the trigger hasn't, the effect misfires.


~~**Promote `PositionMove` and retire the `Move` alias**~~ — done; `Move` alias deleted, all 24 files updated to `PositionMove`. New solves also now stamped `schemaVersion: 2` at creation.


Scanned 2026-04-09. Items #1, #2, #4, #5, #8, #9 done. ~~#10 was a false positive~~ (`bestAo` is not exported and IS used). Remaining:

~~**#3 — TrendsModal.tsx is 786 lines**~~ — moved to Statistic section

**~~#6 — useReplayController.ts `playFrom` is 70 lines~~** — skipped; not worth it. The only extract with real value (`scheduleMoves` as a pure function) has low ROI since this code isn't changing. Cosmetic inner-function rename doesn't improve understandability enough to justify the churn.

**~~#7 — TimerScreen.tsx 10 useState declarations~~** — done in v1.13 (`useSharedSolve` extracted)

## firebase
- **App Check**: Skip for now. Security rules already lock data to authenticated users — App Check adds a second layer but the main risk is ad blockers silently breaking cloud sync. Worth revisiting if there's real abuse risk or many users. Requires debug token setup for local dev.
- ~~disply id or just a list of number? and when loaing from url, should I still display id?~~