# Future Work

## On-going, Next
- ~~**Manual review: storage module** — the storage module (v1.25.0) has not been manually reviewed end-to-end. Run through the manual test checklist and verify cloud sync, local storage, and import flows work correctly.~~ — done in v1.25.x

## Investigate
- **Save a shared solve into own history** — shared solve at `#shared-F8x2wwtsSuv3I5NEqdNA` needs to be importable into localStorage or Firestore. Currently shared solves are view-only with no way to copy them into your own solve list.
- ~~**Cache loaded Firestore solves across debug/timer toggles** — switching between debug and timer mode appears to re-fetch solves from Firestore each time. Verify this is happening, then decide whether to keep the loaded data in memory (e.g. lift the cache into a hook/context) so the round-trip only happens on first load and explicit refresh.~~ — done in v1.26.0

## Known bugs
- ~~cloud sync mode with url into solves or stats-trend~~ — fixed in v1.7
- ~~[trend stats] - when select range and move mouse out-of-window, it should select the last point but it turns out can't select the range properly because there's no mouse-up triggered to finish the selection~~ — fixed in v1.13
- ~~[trend stats] zoom is stored as positional xIndex range, so switching method/driver filter while zoomed makes the chart look empty (the indices point past the end of the filtered array). Repro: zoom on "all" → switch to roux/cfop → chart looks empty → switch back to all → points return. Desired: zoom should survive method/driver filter changes by translating the zoom range across filter sets (e.g. store zoom as a date or seq range, or remap xIndex on filter change). Zoom SHOULD still reset on sort/window-size change (current behavior is correct for those). See `src/components/TrendsModal.tsx:328` (zoomStack state) and `TrendsModal.tsx:366–371` (reset useEffect).~~ — done in v1.30.0

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
- ~~**Sort-by-timestamp toggle in Trends**~~ — done in v1.29.0 (Sort dropdown Seq/Date; `sortAndSliceWindow`; `xIndex` rename on data points)
- **`totalToggle` not restored from URL deep-link** — `TrendsModal` hardcodes initial `totalToggle` to `{ exec: false, recog: false, total: true }` instead of reading from `initialParams`. Pasting a `#trends?ttotal=exec,recog` URL doesn't restore the toggle. (Spotted during v1.29.0 review.)


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

## Tooling

- **Extend `scripts/cost_extract.py` into a Claude skill** — wrap the script as a skill so cost queries ("what did this session cost?", "show me the storage-module breakdown") work conversationally without manually constructing CLI args or knowing the project-dir path.

## UX

- ~~**Resequence: show scope before confirming** — the "Renumber all cloud solves" action currently uses a JS `confirm()` prompt with no preview. Before asking the user to confirm, show how many documents will be updated (e.g. "This will renumber 312 solves. Proceed?") so the scope is visible before committing.~~ — done in v1.27.0

## Code Quality (Refactor Backlog)

**Consider removing `src/hooks/useSolveStore.ts` wrapper** — The hook wraps `useSyncExternalStore(solveStore.subscribe, solveStore.getSnapshot)` plus re-exports CRUD methods. It's pure sugar; consumers could call `useSyncExternalStore` directly and import CRUD from the store module. Revisit once we see how often consumers actually use the wrapper vs. reach for specific pieces — if usage is thin, drop the indirection.

**Make `method` and `driver` non-optional on `SolveRecord`** — both fields are currently `string | undefined` in `src/types/solve.ts`. The optionality forces `?? 'cfop'` / `?? 'cube'` fallbacks throughout the filter and stats pipeline (`filterSolves`, `filterStats`, the new `StatsSolvePoint` projection, etc.), and the same pattern silently miscategorizes legacy records (e.g. 20 pre-method-field records bucket into CFOP via the fallback — see v1.29.1 diagnostic). Plan:
1. Backfill existing records in localStorage and Firestore: scan for `method === undefined` / `driver === undefined` and stamp a sensible default (`'cfop'` / `'cube'`), or surface a debug UI that lets the user explicitly assign. Include example solves and shared-solve registry docs so every persisted solve has both fields.
2. Tighten the type: change to `method: 'cfop' | 'roux' | 'freeform'` and `driver: 'cube' | 'mouse' | 'button'` (or appropriate union).
3. Remove all `?? 'cfop'` / `?? 'cube'` fallbacks in filters and downstream code.
4. StatsSolvePoint also drops the optionality.
Once done, the filter code becomes `p.method === filter.method` with no silent-bucket behavior.

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
- **Remove `seq` field — derive display number from sorted position** — `seq` is the human-readable solve number shown in the sidebar (#1, #2, …). It's stored on every solve, tracked by a `meta/counter` document in Firestore, synced to `sans_cube_next_id` in localStorage on every page load, and requires an explicit renumber operation when it drifts out of sync. The core question: do we actually need a stored field for this, or can we just use the solve's rank in the date-ordered list? Impact analysis: (1) **Display** — any place that renders `solve.seq` would instead use `index + 1` over the sorted list; this is already how the sidebar renders it conceptually. (2) **Firestore counter** — `meta/counter` and `loadNextSeqFromFirestore` become unnecessary; the counter sync on page load goes away. (3) **`nextSolveIds()`** — the seq allocation logic in `solveStore` simplifies significantly; `id` in cloud mode is already `Date.now()` and doesn't depend on seq. (4) **Resequence panel** — the entire "fix seq" debug feature becomes obsolete. (5) **Schema** — existing `seq` fields on stored records can be ignored at read time without a migration (just stop writing new ones); or stripped lazily. Main risk: if anywhere in the codebase uses `seq` for ordering rather than `date`, removing it changes behavior — audit needed. Also check whether any URL routes or share links encode seq.
- **Single source of truth for solves: clear localStorage after cloud migration** — Currently solves live in both localStorage and Firestore indefinitely. The one-time migration guard (`migratedUids`) is in-memory only, so every page load re-runs `migrateLocalSolvesToFirestore`, silently overwriting Firestore docs (including their `seq` values) with the stale localStorage versions. Root fix: persist the migration guard to localStorage (e.g. `sans_cube_migrated_uids: string[]`) so it survives page reloads, and then clear `sans_cube_solves` in localStorage after a successful migration. Design questions to answer before implementing: (1) **Sign-out behavior** — if localStorage is cleared, signing out leaves no local fallback; options are show an empty state, warn before sign-out, or keep a read-only local cache that's never written back. (2) **Account switching** — signing in as user B after user A clears localStorage correctly starts fresh; signing back in as user A reads from Firestore (correct). (3) **Migration failure** — if the Firestore write partially fails, localStorage must not be cleared. (4) **Offline / auth-not-yet-loaded window** — during the brief authLoading phase the app currently shows localStorage solves; clearing localStorage means showing nothing until auth resolves. The minimum viable fix (persistent migration flag only, no localStorage clear) eliminates the seq-overwrite bug with the least risk and can ship independently of the broader single-source-of-truth design.