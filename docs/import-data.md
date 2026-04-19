# Importing data from other sources

A guide to bulk-importing past solve history from external sources into sans_cube.

## User guide

### What the importer does

The importer reads an acubemy JSON export and produces `SolveRecord` entries with moves, timestamps, and optional gyro preserved verbatim. It runs our own `ColorMoveTranslator` on the raw move stream so imported solves replay identically to natively-recorded ones, and it computes phases locally via the same phase detector used for live solves — acubemy's own phase analysis is ignored so sans_cube remains the single source of truth for method-specific phase breakdowns.

### How to use it

1. Open the app and switch to debug mode via the [debug] button in the connection bar, or load `#debug` directly.
2. In the maintenance toolbar at the bottom, click **Import from acubemy**.
3. Select your acubemy JSON export.
4. Review the preview table — each row shows date, method, time, moves, and status.
5. Read the "Will import to: …" label to confirm target storage (Cloud vs. Local). Sign in via the Firebase panel if you want to import to cloud.
6. Click **Import N (…)** to commit.

### Status icons

- ✅ new — will be imported
- 🔁 duplicate — already in store (by acubemy solve_id); skipped
- ⚠️ parse-error — a required field was missing or malformed; skipped. Hover for reason.
- ❌ unsolved — moves don't finish solved; skipped. Hover for reason.
- ⚠️ (next to new) — warning; will import but something was dropped. Hover for reason.

### Warnings

- **gyro-dropped** — gyro data was present but malformed. The solve imports without replay gyro data; the 3D cube will still play back moves correctly but won't track hand orientation.

### Known caveats

- Imported solves land at the end of the `seq` counter even though their dates are historical. This causes a backward time-jump in the Trends chart (shown by date ascending). Sort-by-seq is unaffected.
- The v1 UI does not badge imported solves visually — they look like native solves in the history list. A badge is planned (see `future.md`).
- Re-importing the same export skips duplicates. There is no "update existing" flow in v1 (see `future.md`).

### Manual smoke-test files

`tests/fixtures/manual/acubemy/` contains 13 hand-crafted JSON files that exercise every error path and the happy path. Drag each into the file picker and confirm the expected status:

| File | Expected |
|---|---|
| `1_invalid_json.json` | File-level: "File is not valid JSON." |
| `2_not_array.json` | File-level: "Expected a JSON array…" |
| `3_empty_array.json` | "No solves found in file." |
| `4_not_acubemy.json` | "This doesn't look like an acubemy export." |
| `5_missing_field.json` | 1 row, `parse-error` — "Missing field: raw_solution" |
| `6_invalid_date.json` | 1 row, `parse-error` — date parse reason |
| `7_invalid_token.json` | 1 row, `parse-error` — "Invalid token 'Q' at position 2" |
| `8_unsupported_scramble.json` | 1 row, `parse-error` — "Unsupported scramble token 'Rw'…" |
| `9_unsolved.json` | 1 row, `unsolved` |
| `10_unknown_method.json` | 1 row, `new`, method = `freeform` |
| `11_malformed_gyro.json` | 1 row, `new` with ⚠️ warning tooltip mentioning gyro |
| `12_duplicates.json` | 2 rows, all `duplicate` (after importing 13 first) |
| `13_happy_path.json` | 2 rows, all `new`, no warnings |

## Sources

_The sections below are internal reference for maintainers describing each external source's export format and our field-mapping decisions. Safe to skip if you only want to use the importer._

### Acubemy

#### Reference: export format

- `solve_id` — numeric external ID. Unique per solve in acubemy. → used as `importedFrom.externalId` (dedup key).
- `date` — ISO 8601 string; solve-completion timestamp. → parsed to Unix ms, stored as `SolveRecord.date`.
- `scramble` — scramble string in standard WCA-compatible notation. → stored as `SolveRecord.scramble`.
- `total_time` — wall-clock solve duration in ms. → ignored; we derive from `raw_timestamps[last]` to avoid divergence.
- `raw_solution` — space-separated flat move stream: outer-face turns only, one letter per quarter-turn (e.g. `U R U' R'`). Letters map to **colors** via a fixed Western scheme (U=W, D=Y, F=G, B=Blue, L=O, R=Red). Slice moves like M/E/S are expressed as two simultaneous outer turns (e.g. `L R'` with identical or near-identical timestamps), which is structurally equivalent to our `ColorMove` stream — the cube hardware emits per-face color events and acubemy records them verbatim. → fed through our `ColorMoveTranslator` to produce `PositionMove[]` with slice pairing and v1→v2 center tracking.
- `raw_timestamps` — array of timestamps (ms since first move), one per `raw_solution` token. First value is always 0; last equals `total_time`. → zipped with `raw_solution` to form `ColorMove.cubeTimestamp`; last value also gives `SolveRecord.timeMs`.
- `solution` — space-separated move string in **position-based notation** with doubles/rotations/wides/slices (e.g. `R U R' U' F2 M'`). Analogous to our `PositionMove` stream — it's acubemy's own interpretation of the raw events, with pairs collapsed to slices. → ignored on import; we run our own translator on `raw_solution` to produce our canonical `PositionMove[]`, so we don't trust their interpretation.
- `analysis_type` — method string: `"cfop"`, `"roux"`, etc. → mapped to `SolveRecord.method`; unknown values fall back to `freeform`.
- `gyro_data` — array of `{ q: {w,x,y,z}, t }` samples (see §6). → mapped to `SolveRecord.quaternionSnapshots`.
- `cross_*`, `f2l_pair*_*`, `oll_*`, `pll_*` — acubemy's phase analysis (phase labels, move counts, timings). → ignored; we compute phases ourselves via the existing phase detector so sans_cube's phase model remains the single source of truth.
- Any other top-level field not listed above — **unknown / not explored**. Worth investigating in a follow-up if the importer needs more data, but not required for v1. Document them here as they're discovered.

#### Our field mapping

| Acubemy field | sans_cube destination | Notes |
|---|---|---|
| `solve_id` | `importedFrom.externalId` | dedup key |
| `date` | `SolveRecord.date` | ISO 8601 → Unix ms |
| `scramble` | `SolveRecord.scramble` | stored verbatim |
| `total_time` | — ignored | derived from `raw_timestamps[last]` |
| `raw_solution` + `raw_timestamps` | `SolveRecord.moves` | via `ColorMoveTranslator` |
| `solution` | — ignored | we run our own translator |
| `analysis_type` | `SolveRecord.method` | unknown → `freeform` |
| `gyro_data` | `SolveRecord.quaternionSnapshots` | `q.{w,x,y,z}, t` → `{quaternion, relativeMs}` |
| `cross_*`, `f2l_*`, `oll_*`, `pll_*` | — ignored | we compute phases via `computePhases` |
| any other field | — unknown / unexplored | |

#### Verified semantics

- `date` = completion time (confirmed against acubemy UI).
- `raw_timestamps[0] = 0`; `raw_timestamps[last] = total_time`.
- `gyro_data[*].t` = ms since first move, same frame as `raw_timestamps`.
- Color scheme = Western (U=W, D=Y, F=G, B=Blue, L=O, R=Red).
- Gyro sample rate ≈ 22 Hz from hardware; acubemy records all samples (no throttle).
- Quaternion reference frame assumed to match sans_cube's raw sensor frame. Empirical verification is tracked as a follow-up item in `future.md`.
