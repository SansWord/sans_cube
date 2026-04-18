# Acubemy Import — Design Spec

**Date:** 2026-04-18
**Status:** Draft (pending review)

## 1. Overview & Goals

A one-way bulk importer that brings acubemy-exported JSON solves into sans_cube, preserving historical data (moves, timestamps, gyro, method).

### Goals

- Let SansWord (and future users) recover past solve history from acubemy.
- Preserve replay-grade data: move stream + timestamps + gyro so imported solves replay correctly in the 3D cube view.
- Extensible to other sources later (`importedFrom.source` can grow beyond `'acubemy'`).

### Non-goals (v1)

- Editing / deleting individual solves before import (preview is read-only; no per-row toggles).
- Re-exporting back out of sans_cube.
- Syncing a user's acubemy account (it's a file-based, manual operation).
- Orientation normalization UI — assumes acubemy's Western color scheme (U↔W, D↔Y, F↔G, B↔Blue, L↔O, R↔Red), which has been verified.

### Success criteria

Importing `data_input/example.json` (1 CFOP + 1 Roux) results in 2 `SolveRecord`s that replay identically to natively-recorded solves, with phases auto-computed.

## 2. Schema Change

Add one optional field to `SolveRecord` in `src/types/solve.ts`:

```ts
importedFrom?: {
  source: 'acubemy'            // union type; extensible later
  externalId: number | string  // acubemy's solve_id (numeric); string allowed for future sources
}
```

### Behavior

- **Dedup key:** `(source, externalId)` uniquely identifies an external solve.
- **Display (v1):** imported solves look like any other solve in the history list. Dedicated "imported from acubemy" badge is deferred.
- **`schemaVersion`:** imported records are born as `schemaVersion: 2` (the translator produces v2-style center-tracked PositionMoves).
- **`seq`:** continues from `max(existingSeq) + 1` across the batch.
- **`id`:**
  - localStorage mode — sequential integer, continues from local counter.
  - Firestore mode — uses acubemy's historical completion timestamp (ms). On collision with an existing doc, bump by +1ms until unique.
- **`date`:** always set to acubemy's historical completion timestamp (Unix ms), regardless of storage mode. See §6 for the start-vs-completion semantics TBD.

## 3. Import Pipeline

```
[1] File picker → JSON.parse → validate array shape
        ↓
[2] Build dedup set from existing store: Set<"acubemy:externalId">
        ↓
[3] For each record:
    a. Validate required fields are present and non-empty (see §6)
       → missing any? classify as "parse-error", skip the rest.
       → raw_solution / raw_timestamps empty, or lengths mismatch? parse-error.
    b. Check externalId against dedup set
       → duplicate? classify as "duplicate", skip c–i.
    c. Parse raw_solution + raw_timestamps → ColorMove[]
    d. Feed ColorMove[] through ColorMoveTranslator → PositionMove[]
       (slice pairing via FAST_WINDOW_MS is handled inside the translator)
    e. Solvability check: apply scramble + PositionMoves to SOLVED_FACELETS,
       then call isSolvedFacelets(finalFacelets) → must return true
    f. Method detection from analysis_type
       (missing/unknown → freeform fallback, NOT parse-error)
    g. Compute phases via existing phase detector (same code path as native solves)
    h. Map gyro_data → QuaternionSnapshot[]
       (gyro_data missing is fine → quaternionSnapshots undefined;
        gyro_data present but malformed → quaternionSnapshots undefined + warning)
    i. Build SolveRecord draft:
       - date: new Date(acubemy.date).getTime()
       - timeMs: raw_timestamps[raw_timestamps.length - 1]
       - importedFrom: { source: 'acubemy', externalId: solve_id }
        ↓
[4] Classify each row: new | duplicate | parse-error | unsolved
    (new rows may additionally carry warnings, e.g. gyro-dropped)
        ↓
[5] Preview table rendered → user clicks "Import N (skipping: X duplicate, Y parse-error, Z unsolved)"
        ↓
[6] Commit: write only `new` rows via the current storage write path
    (same code as recording a native solve — no new write API)
```

### Reuses existing code

- `ColorMoveTranslator` for slice pairing + v1→v2 color-to-face translation.
- `parseScramble` for the scramble string (used inside solvability simulation only).
- Phase detector (same path as `useSolveRecorder`) for `phases`.
- `useSolveHistory.append` (or equivalent) for the write — no new storage plumbing.
- `isSolvedFacelets` at `src/utils/applyMove.ts:204` for the solvability check.

### New code

All new utilities live in `src/utils/acubemyImport/`:

- `parseExport.ts` — top-level file validation + per-record orchestration.
- `parseRawSolution.ts` — token + timestamp stream → `ColorMove[]`.
- `gyroMap.ts` — acubemy `gyro_data` → `QuaternionSnapshot[]`.
- `verifySolvability.ts` — cube-state simulator check wrapper around `isSolvedFacelets`.

New component: `src/components/AcubemyImportModal.tsx`.

### Scramble storage

Scramble is stored as a string on `SolveRecord` (same as native solves). Scramble parsing only happens inside `verifySolvability.ts` as an implementation detail.

## 4. Preview UI

### Trigger

Debug mode panel → button labeled "Import from acubemy". On click, opens `AcubemyImportModal`.

### Modal states

1. **Initial** — file picker + help text: "Select your acubemy JSON export."
2. **Parsed** — preview table rendered.
3. **Writing** — non-dismissable overlay with indeterminate spinner: `Importing solves to cloud…` (or `…to local storage…`).
4. **Error** — file-level errors replace the preview with an error message + "Try another file" button.

### Preview table

Columns: `#`, `Date`, `Method`, `Time`, `Moves`, `Status`.

| # | Date | Method | Time | Moves | Status |
|---|------|--------|------|-------|--------|
| 1 | 2025-12-03 14:22 | cfop | 18.42s | 73 | ✅ new |
| 2 | 2025-12-03 14:25 | cfop | 16.10s | 68 | ✅ new ⚠️ |
| 3 | 2025-12-03 14:30 | cfop | — | — | ⚠️ parse-error |
| 4 | 2025-12-04 09:11 | roux | 22.05s | 81 | 🔁 duplicate |
| 5 | 2025-12-04 09:18 | cfop | 15.30s | 68 | ❌ unsolved |

- Rows sorted by date ascending (historical order).
- Status cells use tooltips for details on errors and warnings.
- No per-row checkboxes.
- `parse-error` rows still show whatever fields we *could* read (date, time, scramble) so users can identify them.

### Target-storage label

Shown above the table:

- Cloud mode: `Will import to: Cloud (Firestore) ☁️ — logged in as <email>`
- Local mode: `Will import to: Local browser storage 💾 — sign in to import to cloud`

The label is based on `cloudConfig.enabled` at modal-open time and **re-checked at commit time**. If the value changed between open and commit, show: `Target changed to Local — proceeding with current setting.`

### Action buttons

- `Cancel` — closes modal, nothing written. Disabled during Writing state.
- `Import N (skipping: X duplicate, Y parse-error, Z unsolved)` — primary. Disabled when N=0.

### Warnings

Warnings are non-blocking info flags. A row stays `new` but shows ⚠️ next to the status with a tooltip.

v1 warnings:

- `gyro-dropped` — `gyro_data` was present but failed validation. Tooltip: `Gyro data present but malformed — will import without replay gyro.`

Warnings don't affect the skip-breakdown count. Not stored on `SolveRecord` — once imported, a warned row is indistinguishable from a clean `new` row.

### Writing overlay

- Activates on "Import N…" click.
- Blocks backdrop clicks and Esc.
- Shows indeterminate spinner only (no per-record progress).
- Cancel disabled during write.
- On success: overlay dismisses, toast fires (`Imported N solves from acubemy.`), modal closes.
- On error: overlay dismisses, inline error message: `Import failed after N solves. Any solves already written remain.`

localStorage mode: write is synchronous, overlay is a brief flash or skipped.

### In-memory state update

No extra work needed:

- **Firestore mode:** `useSolveHistory` uses `onSnapshot` — new records show up in the in-memory array automatically.
- **localStorage mode:** `useSolveHistory.append` updates local state and localStorage in the same call.

## 5. Storage Target Logic

**The rule:** import target = current cloud sync mode. No manual override.

| Cloud sync state | Target | Label |
|---|---|---|
| Enabled (signed in, toggle on) | Firestore | `Will import to: Cloud (Firestore) ☁️ — logged in as <email>` |
| Disabled | localStorage | `Will import to: Local browser storage 💾 — sign in to import to cloud` |

- `cloudConfig.enabled` is read at modal-open time for the label.
- Re-checked at commit time to avoid silently writing to the wrong store if the user toggles mid-flow.
- Import goes through `useSolveHistory.append`, which already routes by `cloudConfig`. No new routing logic in the importer.

## 6. Validation & Error Handling

### File-level (before preview renders)

| Failure | Error message |
|---|---|
| Not valid JSON | `File is not valid JSON.` |
| Top-level isn't an array | `Expected a JSON array of solve records.` |
| Array is empty | `No solves found in file.` |
| No records have required acubemy fields | `This doesn't look like an acubemy export.` |

File-level errors replace the preview table; the user sees a "Try another file" button to reset.

### Required fields (absence → parse-error)

- `solve_id` — external ID, dedup key
- `date` — ISO 8601 string (e.g. `"2026-04-18T10:09:22.202Z"`); converted to Unix ms via `new Date(date).getTime()`. **Start-vs-completion semantics: TBD.** sans_cube's native `date` is solve-completion time; this spec currently assumes acubemy's is too. If empirical testing shows acubemy's `date` is solve-start time, the pipeline should add `timeMs` when populating `SolveRecord.date` so the stored value remains completion time.
- `scramble` — scramble string
- `raw_solution` — authoritative move stream (must be non-empty)
- `raw_timestamps` — matching timing array (must be non-empty; length must equal `raw_solution` length)

### Optional fields (used if present, tolerated if absent)

- `analysis_type` → method detection, fallback to `freeform`
- `gyro_data` → `quaternionSnapshots`

### Derived fields (computed from required inputs)

- `timeMs` — derived as `raw_timestamps[raw_timestamps.length - 1]` (the first element is always `0`, the last is the wall-clock solve duration). No separate `total_time` field is read from acubemy because it's redundant — in both observed example records it exactly equals the last `raw_timestamps` value.

### Ignored fields

Acubemy provides these; we don't read them:

- `solution` (we use `raw_solution` as authoritative)
- `total_time` (redundant with `raw_timestamps[last]` — we derive it)
- `cross_*`, `f2l_pair*_*`, `oll_*`, `pll_*` (we compute phases ourselves)
- Any other acubemy-specific field

Extra fields are silently ignored — no "unknown field" warning. Forward-compat if acubemy adds new fields later.

### Per-record classification

Each row ends up with one of:

- **`duplicate`** — `externalId` already in store. No reason shown.
- **`parse-error`** — something in the pipeline threw. Tooltip shows the first error, examples:
  - `Missing field: raw_solution`
  - `Invalid token "X" at position 42`
  - `raw_timestamps length (72) ≠ raw_solution length (73)`
  - Unknown `analysis_type` does NOT cause parse-error (falls back to freeform).
- **`unsolved`** — pipeline completed but `isSolvedFacelets(finalState)` returned false. Tooltip: `Final cube state not solved after applying scramble + moves.`
- **`new`** — passed all checks. May carry warnings.

### Gyro validation rules

Acubemy's `gyro_data` format (confirmed against `example.json`):

```json
{
  "q": { "w": 0.04584, "x": 0.34036, "y": 0.70443, "z": -0.62107 },
  "t": 0
}
```

Field mapping to `QuaternionSnapshot`:

| acubemy | sans_cube |
|---|---|
| `entry.q.x` | `snapshot.quaternion.x` |
| `entry.q.y` | `snapshot.quaternion.y` |
| `entry.q.z` | `snapshot.quaternion.z` |
| `entry.q.w` | `snapshot.quaternion.w` |
| `entry.t` | `snapshot.relativeMs` |

`t` is already relative to solve start (first entry is always `t: 0`), so no timestamp subtraction is needed.

Each `gyro_data` entry must:

- Be an object.
- Contain a nested `q` object with numeric `x`, `y`, `z`, `w` quaternion components.
- Contain a numeric `t`.
- All five numbers must pass `Number.isFinite()`.

Outcome of gyro validation:

- All entries valid → populate `quaternionSnapshots`.
- Array empty, missing, or ANY entry fails → `quaternionSnapshots = undefined`, record still classifies as `new`.
- If `gyro_data` was present but unusable → add `gyro-dropped` warning to the row so the user sees data loss in preview.
- If `gyro_data` was simply absent → no warning.

### Implementation rules

- Never throw out of the top-level pipeline; every per-record step is wrapped.
- Accumulate error reasons but show only the first (one tooltip line is enough).
- `parse-error` rows still display whatever fields we could read.

## 7. Testing Approach

### Unit tests (Vitest)

- `parseRawSolution.test.ts`:
  - Basic outer turns with correct timestamps.
  - Simultaneous pairs (→ ColorMoveTranslator fuses them into a slice).
  - Invalid token → throws with position.
  - Timestamp length mismatch → throws.
- `gyroMap.test.ts`:
  - Standard case.
  - Empty array.
  - Malformed entries (NaN, missing field, non-object, wrong type).
- `verifySolvability.test.ts`:
  - Known-good solve → `true`.
  - Same solve with last move stripped → `false`.
  - Scramble only (no moves) → `false`.
- `parseExport.test.ts`:
  - Full happy path on a single record.
  - Each required field missing → specific error message.
  - Unknown `analysis_type` → maps to `freeform`, no error.
  - Dedup short-circuit: spy on `parseRawSolution` to confirm it isn't called for duplicates.

### Golden fixture test

`acubemyImport.golden.test.ts`:

- Input: `tests/fixtures/acubemy_example.json` (copied from `data_input/example.json`, committed to repo).
- Runs full pipeline end-to-end.
- Asserts 2 `SolveRecord`s with pinned expectations:
  - `method`, `timeMs`, `moves.length`, `phases.length`, `importedFrom`, `schemaVersion === 2`.
  - Roux example must contain at least one slice move (`M`/`E`/`S`) in `moves` (proves pairing worked).

### Component tests

`AcubemyImportModal.test.tsx`:

- Open → file picker visible.
- After file parsed → table with correct status icons and counts.
- Import button text matches skip-breakdown format.
- Import button disabled when zero `new` rows.
- Clicking import fires `append` calls only for `new` rows.
- Writing overlay is present and non-dismissable during mocked async write.
- Batch write error → overlay dismisses, error shown.

### Manual test files

Prepared in `data_input/acubemy_test/` (uncommitted, for SansWord to drag into the picker). Files 5–8 start from real records in `example.json` and mutate a single field; `gyro_data` may be removed on slightly-broken records as needed.

| Filename | Scenario | Expected outcome |
|---|---|---|
| `1_invalid_json.json` | Malformed JSON | File-level: "File is not valid JSON." |
| `2_not_array.json` | Top-level is `{}` | File-level: "Expected a JSON array of solve records." |
| `3_empty_array.json` | `[]` | File-level: "No solves found in file." |
| `4_not_acubemy.json` | Array of unrelated objects | File-level: "This doesn't look like an acubemy export." |
| `5_missing_field.json` | One record missing `raw_solution` | Mixed preview; one `parse-error` with "Missing field: raw_solution" |
| `6_invalid_token.json` | `raw_solution: "U R Q L"` | One `parse-error` with "Invalid token at position 2" |
| `7_unsolved.json` | Last move stripped | One `unsolved` row |
| `8_unknown_method.json` | `analysis_type: "yau"` | Row imports as `freeform`, no error |
| `9_duplicates.json` | Same records as `example.json` | After importing example first, all rows `duplicate` |
| `10_happy_path.json` | Same as `tests/fixtures/acubemy_example.json` | All rows `new` |

### Not tested (out of scope for v1)

- Actual Firestore round-trip (mocked; existing Firestore integration tests cover it).
- Real acubemy API / login (file-only consumer).

## 8. Out of Scope & Future

### Deferred UI polish

- "Imported from acubemy" badge in `SolveDetailModal`.
- Per-row exclusion checkboxes in preview.
- Per-record progress indicator during write.
- Warning-count in import button label.
- Top-level menu entry for the importer (lives in `#debug` only).

### Deferred features

- Paste-JSON input method.
- Editing records before import.
- Live sync / re-sync from acubemy.
- Sort-by-timestamp toggle in Trends (to normalize "backward time jump" for historical imports).
- Other source adapters (`csstimer`, `qqtimer`) — `importedFrom.source` schema is extensible but the parser is acubemy-specific in v1.
- **Re-import / update for records with warning state** — let the user re-run import on a fresh export to recover dropped data (e.g. re-capture gyro for rows flagged `gyro-dropped`). Requires separate design: overwrite vs merge vs diff. Tracked in `future.md`.

### Documentation updates shipping with the feature

- **`docs/import-data.md`** (new) — user-facing guide + internal design reference. Covers supported formats, how-to, dedup behavior, warning semantics, `importedFrom` schema. Added to CLAUDE.md's Documentation list.
- `docs/storage.md` — note the `importedFrom` field on `SolveRecord`.
- `docs/debug-mode.md` — add the "Import from acubemy" button.
- `docs/ui-architecture.md` — add `AcubemyImportModal`.
- `docs/devlog.md` — session entry.
- `future.md` — mark done if listed; add "sort-by-timestamp toggle in Trends" and "re-import for warning state".
