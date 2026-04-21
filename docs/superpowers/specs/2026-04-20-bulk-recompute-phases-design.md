# Bulk Recompute Phases — design notes

**Status:** deferred (captured 2026-04-20, after v1.24.1 shipped)

## Why this exists

v1.24.0 (CFOP) and v1.24.1 (Roux) changed the `isDone` phase predicates so they tolerate M/E/S center drift and whole-cube rotations. Existing `SolveRecord`s already on disk / in Firestore store **pre-computed `phases: PhaseRecord[]`** arrays that were frozen under the OLD predicates. Those arrays have stale phase-boundary timestamps for any solve that used M/E/S mid-solve.

## Who is affected

- **Roux solves** with M/E/S during LSE — essentially every Roux solve. Under the old logic, `isCMLLDone` required W on U, so a drifted-centers state after M-moves wasn't recognized as CMLL-complete until the cube coincidentally de-drifted or was fully solved. The CMLL→LSE boundary likely shifts earlier (sometimes significantly); LSE duration likely shrinks.
- **CFOP solves** with M/E/S (rare — Niklas, some PLLs). Similar boundary shifts on OLL→PLL.
- **Solves with no slice moves** — no effect. Old and new predicates agree on drift-free states.

The cube ends up solved either way, so total `timeMs` is correct. Only the per-phase `recognitionMs` / `executionMs` / `turns` breakdown is stale.

## Existing machinery (don't re-build)

- `src/utils/recomputePhases.ts` — pure function `recomputePhases(solve, method): PhaseRecord[] | null`. Replays `solve.moves` from `solve.scramble` under the given method and returns fresh phases. Already used by:
  - `SolveDetailModal` (per-solve method change, v1.8)
  - `detectMethod.ts` → `detectMethodMismatches` (debug-mode bulk scanner, v1.9 — scans but doesn't write back)
  - `migrateSolveV1toV2.ts` (schema migration)
  - `acubemyImport/parseExport.ts` (importer)
- `detectMethod.ts` is the closest existing pattern for "iterate all solves, recompute, flag diffs." The new feature should mirror its dry-run-first ergonomics.

## Proposed feature: debug-mode "Recompute phases for all solves"

### UX

1. Inline `RecomputePhasesPanel` rendered inside the debug section, next to the existing "Detect CFOP/Roux mismatches" / "Migrate v1→v2" panels.
2. **Dry-run first:** scan all solves, call `recomputePhases(solve, solve.method)` for each, diff against stored `solve.phases`, show a summary:
   - Total solves scanned
   - Solves with **changed** phases — count + a sample of 3-5 rows showing solve id, stored method, and old vs new phase boundary timestamps
   - Solves **unchanged** — count only
   - Solves that **failed to recompute** — count + list of solve ids. Solves in this bucket are surfaced so the user can investigate; **they are excluded from the commit step** (we don't want to overwrite with stale data a solve whose own moves don't even replay to solved).
3. "Commit N changes" button to write back **only the changed, successfully-recomputed solves**. For localStorage: single `saveToStorage` write of the updated array. For Firestore: chunked `Promise.all(setDoc)` in chunks of 100, displaying "Committing batch X of Y" during the operation.
4. Skip `isExample` solves and `freeform` method (same skips as `detectMethodMismatches`).

### Non-goals

- **No auto-recompute on app load.** Too invisible; risk of silently rewriting user data with a buggy predicate update.
- **No migration of `timeMs`** — not needed; total time is independent of phase breakdown.
- **No schema version bump.** Data shape is unchanged; only values refresh.

### Edge cases to think about

- **Solves whose stored `method` is `freeform`:** skip (single "Solved" phase, not affected).
- **Solves missing `moves` or `scramble`:** `recomputePhases` already returns `null` for empty moves. Show in the "failed" bucket.
- **Cloud-sync mode:** writing back to Firestore incurs N writes. Use chunked `Promise.all(setDoc)` (chunks of 100) and display "batch X of Y" progress while committing. See the "Firestore batch-size sizing" section below for why chunks of 100 over `writeBatch` of 500.
- **Mixed local + cloud:** only operate on the currently-active store (localStorage XOR Firestore, whichever `useSolveHistory` is using).
- **Undo:** no undo button. Before running, strongly recommend user run "Backup solve data" from debug mode first (see `docs/data-backup.md`). The panel should render this warning prominently above the "Scan" and "Commit" buttons.

### Files likely touched

- `src/utils/recomputeAllPhases.ts` (new) — bulk scanner that returns `{unchanged, changed: {solve, oldPhases, newPhases}[], failed: solve[]}`.
- `src/components/RecomputePhasesPanel.tsx` (new) — self-contained panel component rendered inside the debug section. Owns its own `{scanning, results, committing, commitProgress}` state. Receives solves and a cloud-vs-local write callback from the parent. Two sub-buttons inside the panel: "Scan (dry run)" and (once results exist) "Commit N changes" / "Cancel". Progress while committing: "Committing batch X of Y".
- `src/App.tsx` — mount `<RecomputePhasesPanel />` inside the debug section, alongside the existing method-mismatch scanner. Follow the same two-button split (one for Firestore, one for localStorage) that the v1.9 scanner uses at ~lines 365-371 (cloud) and ~lines 417-422 (local). The existing scanner is state + button + table inlined directly in `App.tsx`; **bulk-recompute extracts into a component** to avoid adding more inline state/table blocks to `App.tsx`.
- Firestore bulk writer: new function in `src/services/firestoreSolves.ts` — chunked `Promise.all(setDoc)` in chunks of 100, with a per-chunk progress callback so the panel can render "batch X of Y". Copy the error-handling shape from `migrateSolvesToV2InFirestore` (per-doc try/catch, collect failures). Not `writeBatch` — 500-solve batch would exceed Firestore's 10 MB payload limit given current ~35 KB-per-solve size (see "Firestore batch-size sizing" above).
- LocalStorage bulk writer: can write back via `saveToStorage(STORAGE_KEYS.SOLVES, updated)` in one call.
- `docs/debug-mode.md` — document the buttons (per CLAUDE.md rule: "Keep `docs/debug-mode.md` up to date whenever you add, remove, or change a button or panel in the debug mode section").
- `docs/devlog.md` — entry at commit time.
- Tests: unit-test `recomputeAllPhases` against a mixed fixture (some with M, some without); assert no-change for drift-free solves; assert changes for M-containing solves.

### Verified facts (2026-04-20)

- `src/utils/recomputePhases.ts:107` — `recomputePhases(solve, method): PhaseRecord[] | null` signature unchanged.
- `src/App.tsx:87-100` — `handleDebugUpdate` is the existing pattern for per-solve write-back (handles cloud vs local via `cloudSync.enabled && cloudSync.user` gate).
- No dedicated modal component for the v1.9 method-mismatch debug action. Bulk-recompute is rendered inline inside the debug section as well (not a modal), but extracted into its own `RecomputePhasesPanel` component so `App.tsx` doesn't accumulate more inline state + table blocks.

### Resolved design decisions (2026-04-20 brainstorm)

1. **UI detail level:** count + 3-5 sample rows (not per-solve old-vs-new tables). Sample rows show solve id, stored method, and old vs new phase boundary timestamps for 3-5 representative changed solves.
2. **Failed recomputes are hard errors, not silent skips.** If `recomputePhases(solve, solve.method)` returns `null` (e.g., replay fails to reach solved state), surface that solve in a "Failed" bucket in the dry-run summary, and **exclude failed solves from the commit step**. The user should investigate before the feature touches that solve's data. Reason: a solve whose stored moves don't replay to solved under the current predicates is a red flag — writing anything back would compound the problem.
3. **No `phasesRecomputedAt` timestamp field.** YAGNI: we have no concrete consumer that needs to distinguish "phases computed under v1.24.1" from "phases computed under an older predicate." If such a need materializes later, we can re-run the same bulk action — it's idempotent. Adding a schema field now costs migration complexity for speculative benefit.
4. **Panel placement:** new inline `RecomputePhasesPanel` component rendered inside the debug section, not a modal. Mirrors the existing v1.9 method-mismatch pattern (state + buttons + results table colocated in `App.tsx`'s debug section) but extracted into its own component to keep `App.tsx` from growing further. Component manages its own `{scanning, results, committing}` state; parent passes in the solves list and the cloud-vs-local write callback.
5. **Firestore writer:** chunked `Promise.all(setDoc)`, **chunks of 100**, progress displayed as "batch X of Y committed." No `writeBatch` — see sizing note below.

### Firestore batch-size sizing (measured 2026-04-20)

Measured against `src/data/exampleSolves.ts` using `JSON.stringify`:

| Example solve | Moves | JSON bytes |
|---|---|---|
| Mouse driver (id -1) | 88 | 37,055 |
| GAN cube CFOP (id -2) | 96 | 32,465 |
| GAN cube Roux (id -3) | 92 | 37,530 |

Average ≈ 35 KB per solve, dominated by per-move quaternion snapshots.

- A 100-solve chunk ≈ 3.5 MB. Safe under Firestore's 10 MB per-write-batch limit and keeps each RPC small enough for timely progress updates.
- A 500-solve `writeBatch` ≈ 17.5 MB — **exceeds** Firestore's 10 MB `writeBatch` payload limit. Real users with hundreds of solves would hit `INVALID_ARGUMENT` / payload-too-large errors.
- Chunked `Promise.all(setDoc)` sidesteps the batch payload limit entirely (each `setDoc` is an independent RPC). This also matches the existing bulk patterns at `src/services/firestoreSolves.ts:78-83` (`recalibrateSolvesInFirestore`) and `:91-114` (`migrateSolvesToV2InFirestore`).
- Future note: a deferred schema change (slim `quaternion` or move snapshots) would shrink each solve substantially, at which point revisiting batch size may be worthwhile. Not in scope here.
