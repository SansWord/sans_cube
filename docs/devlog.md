# Dev Log — sans_cube

A record of what was built and what was learned, especially around co-working with Claude Code.

## TL;DR

| Version | What shipped |
|---|---|
| [v1.30.0](#v1300--trends-zoom-cross-filter-persistence-2026-04-23-1152) | Zoom survives method/driver filter changes — four-step pipeline (`buildStatsData→filterStats→windowStats→build*`) assigns stable xIndex before filtering; x-axis domain locks to zoom range; tooltip shows `#N` (xIndex position) |
| [v1.29.1](#v1291--trends-zoom-url-persistence--dev-handle-2026-04-23-1015) | Trends chart zoom survives ESC-from-solve, reload, and URL paste — encoded as `zoom=a,b\|c,d` in the `#trends` hash; reset moved from effect to user-action handlers to avoid StrictMode double-mount wipe; `window.__solves` dev handle |
| [v1.29.0](#v1290--trends-sort-by-timestamp-toggle-2026-04-23-0748) | Sort dropdown (Seq/Date) in Trends fixes backward day labels after import; `sortAndSliceWindow` computes windowed array once per render; `seq→xIndex` rename on data-point interfaces |
| [v1.28.0](#v1280--import-source-badge-2026-04-22-1701) | "Imported from {source}" pill in `SolveDetailModal` header — conditional render gated on `importedFrom`; static provenance label (no link / tooltip); two component tests with `CubeCanvas` stubbed; docs + manual QA updated |
| [v1.27.0](#v1270--resequence-scope-panel-2026-04-21-1248) | Resequence scope panel in debug mode — previews total count, first-mismatch cursor, renumber count before committing; tail-only semantics; `<DebugPanel>` shell extracted from `<RecomputePhasesPanel>` |
| [v1.26.0](#v1260--shared-solve-store-2026-04-21) | Module-level `solveStore` singleton replaces `useSolveHistory`; zero Firestore re-reads on timer/debug toggles; chunked `addMany`; `Refresh solves` button |
| [v1.25.0](#v1250--bulk-recompute-phases-2026-04-20-2119) | Bulk recompute phases debug panel — dry-run scan + commit only changed solves; single mount that branches on cloud-sync state; chunked `Promise.all(setDoc)` for cloud writes; clickable solve ids, sample filtered to turn-count diffs, batch-0 progress, optimized renumber |
| [v1.24.1](#v1241--roux-center-drift--rotation-invariance-2026-04-20-1517) | Roux isDone predicates tolerate M/E/S center drift and whole-cube rotations; extracted shared `cubeGeometry.ts`; rotation-invariance property tests; Sune-based CMLL false-positive guard |
| [v1.24.0](#v1240--cfop-center-drift-tolerance-2026-04-20-1158) | CFOP isDone predicates (`isCrossDone`, `countCompletedF2LSlots`, `isEOLLDone`, `isOLLDone`, `isCPLLDone`) no longer assume Y on D / W on U — look up target color's current face and compare against live centers |
| [v1.23.0](#v1230--acubemy-import-2026-04-18-2226) | Bulk import from acubemy JSON with dedup, preview, and warnings — new `AcubemyImportModal` in debug mode; `importedFrom` schema field; `ColorMoveTranslator.flush()` for batch slice pairing |
| [v1.22.1](#v1221--url-write-effect-mount-time-guards-2026-04-17-1647) | Fix: `#solve-{id}` modal infinite-blink on boot with cloud sync disabled; `#shared-{id}` duplicate history entry — extracted decisions to pure helpers |
| [v1.22.0](#v1220--freeform-method-2026-04-17-1202) | Freeform method — single "Solved" phase; wired into filters, method selector, Trends color map, hash router; `detectMethod` skips Freeform |
| [v1.21.1](#v1211--commutative-ahead-execution-2026-04-17-1015) | Execute the next scramble step before the current one when the two steps commute (opposite faces); live green/orange feedback on the scramble display |
| [v1.21.0](#v1210--scramble-undo-2026-04-17-0247) | Undo completed scramble steps by doing the inverse move; double steps (U2) use warning state seeded at `net=2` for two-move undo/re-complete |
| [v1.20.1](#v1201--url-routing-bug-fixes-2026-04-16-2354) | Fix: `#trends` direct URL / ESC-from-solve blinking; fix `#solve` from trends restoring to trends on ESC; modal overlay opacity reduced |
| [v1.20.0](#v1200--hash-router-consolidation-2026-04-16-2104) | Single `useHashRouter` hook replaces 3 scattered `hashchange` listeners; typed `Route` union; `pushState` on modal open, `replaceState` on param updates |
| [v1.19.4](#v1194--replay-gyro-orientation-correction-2026-04-16-1822) | FSM orientation correction applied during replay — cube no longer drifts after M/E/S moves in playback |
| [v1.19.3](#v1193--per-solve-migrate-button--shared-solve-owner-detection-2026-04-16) | Per-solve "Migrate to v2" button; shared solve owner detection via registry doc; unified review flow |
| [v1.19.2](#v1192--migration-debug-ux--relaxed-invariant--solve-list-color-coding-2026-04-16) | Migration debug button, relaxed invariant (cube-solved only), migrationNote persisted, solve list color coding |
| [v1.19.1](#v1191--eo-detection-fix--migration-invariant--test-coverage-2026-04-16) | EO detection fix (UD+FB split), relaxed migration invariant, v1 fixture + genuine migration test |
| [v1.19.0](#v1190--mes-migration-part-2-2026-04-16-1248) | M/E/S migration — auto-correct stored v1 face labels on load; Firestore migration button + review UX |
| [v1.18.0](#v1180--colormovtranslator--correct-mes-detection-2026-04-16-0506) | `ColorMoveTranslator` — correct M/E/S detection via center tracking; reorientation desync fix |
| [v1.17.1](#v1171--fix-mouse-driver-in-debug-mode-2026-04-15) | Fix: mouse driver moves not working in debug mode CubeCanvas |
| [v1.17.0](#v1170--color-letter-facelets--debug-ux-2026-04-15) | Color-letter facelets rename (W/R/G/Y/O/B), monochromatic solved check, x/y/z rotation moves, #debug URL, debug UX fixes |
| [v1.16.0](#v1160--mac-address-persistence--internal-user-analytics-filter-2026-04-14) | MAC address persistence — save/reuse BLE MAC on macOS, auto-clear on bad MAC; internal user tagged in Analytics |
| [v1.15.0](#v1150--driver-filter-for-sidebar-stats-and-trends-2026-04-14-0357) | Driver filter — filter sidebar stats and Trends by input driver (cube / mouse), persisted and URL-honoring |
| [v1.14.0](#v1140--trends-chart-animation-tuning-2026-04-14) | Trends chart animation tuning — 200 ms draw + ease-out easing, phase chart fix |
| [v1.13.0](#v1130--usesharedsolve-extraction-shared-link-fixes-drag-to-zoom-fix-2026-04-14-0136) | `useSharedSolve` hook; shared link fixes (Firestore error, invalid ID); drag-to-zoom mouse-out fix |
| [v1.12.0](#v1120--code-quality-sweep--bug-fixes-2026-04-14-0113) | Code quality sweep + bug fixes — useCubeDriverEvent hook, CubieData WeakMap, phase merge helper, method-change armed state |
| [v1.11.0](#v1110--firebase-analytics-2026-04-14-0025) | Firebase Analytics — page views, solve events, shared-solve views, driver tracking, consent banner |
| [v1.10.0](#v1100--solve-sharing-2026-04-13-2155) | Solve sharing — capability URLs, public Firestore doc, read-only viewer modal |
| [v1.9.0](#v190--detect-method-mismatches-debug-tool-2026-04-13-2117) | Debug tool — detect CFOP/Roux method mismatches across solve history |
| [v1.8.0](#v180--method-update-in-solvedetailmodal-2026-04-13-1905) | Method update in SolveDetailModal — CFOP ↔ Roux with recomputePhases |
| [v1.7.0](#v170--url-deep-link-fixes--cloud-sync-loading-overlay-2026-04-09-2324) | URL deep link fixes — `#solve-N`, `#trends`, hashchange listener, loading overlay |
| [v1.6.0](#v160--hardware-clock-timing-fix--solve-list-copy-2026-04-09-2240) | Hardware clock timing fix — BLE delay correction, recalibration buttons, copy-as-TSV |
| [v1.5.1](#v151--stats-trends-enhancements--polish-2026-04-09-1401) | Stats Trends enhancements + polish — zoom, day lines, click-to-detail fix, multi-toggle, Esc chain |
| [v1.5.0](#v150--stats-trends-initial-implementation-2026-04-09-0518) | Stats Trends initial implementation — scatter + phase lines, Ao5/Ao12, URL sync |
| [v1.5.0-design](#v150-design--stats-trends-design-session-2026-04-09-0159) | Stats Trends design session — spec created |
| [v1.4.0](#v140--method-filter-in-solve-history-sidebar-2026-04-08-2305) | Method filter in solve history sidebar |
| [v1.3.1](#v131--cloud-loading-ux-2026-04-08-1510) | Cloud loading UX — loading spinner, cloud-ready flash fix |
| [v1.3.0](#v130--firebase-cloud-sync-2026-04-08-1329) | Firebase cloud sync — opt-in Google sign-in, Firestore storage, GitHub Pages deploy |
| [v1.2.0](#v120--mobile--polish-2026-04-06) | Mobile layout, polish |
| [v1.1.0](#v110--roux-method--slice-moves-2026-04-03-to-2026-04-05) | Roux method + slice moves |
| [v1.0.0](#v100--scramble-tracker--timer--solve-history-2026-03-31-to-2026-04-02) | Scramble tracker, timer, solve history |
| [v0.4.0](#v040--example-solves--button-driver-2026-03-30) | Example solves, button driver |
| [v0.3.0](#v030--replay--phase-highlighting-2026-03-28) | Replay + phase highlighting |
| [v0.2.0](#v020--layout--sidebar-2026-03-27) | Layout + sidebar |
| [v0.1.0](#v010--foundation-2026-03-25-to-2026-03-26) | Foundation — BLE connection, 3D cube, move recording |

---

### Learning tags

| Tag | Meaning |
|-----|---------|
| `[note]` | Useful context, well-documented — good to have written down but you'd find it in the docs |
| `[insight]` | Non-obvious; meaningfully changes how you design or debug something |
| `[gotcha]` | A specific trap that bit you; high risk of biting you again — bookmark this |

---

## v1.30.0 — Trends zoom cross-filter persistence (2026-04-23 11:52)

**Review:** complete
**Design docs:**
- Trends zoom cross-filter: [Spec](superpowers/specs/2026-04-23-trends-zoom-cross-filter.md) [Plan](superpowers/plans/2026-04-23-trends-zoom-cross-filter.md)

**What was built:**
- Zoom now survives method/driver filter changes in TrendsModal. Previously, switching filters while zoomed would render an empty chart because xIndex values were reassigned relative to the filtered set. Now they are stable.
- New four-step data pipeline: `buildStatsData(solves, sortMode)` → `filterStats(indexed, filter)` → `windowStats(filtered, N)` → `buildTotalData / buildPhaseData`. `buildStatsData` assigns xIndex before any filter is applied; every subsequent stage passes values through unchanged.
- `StatsSolvePoint` interface in `trends.ts` — the intermediate type that carries `xIndex`, `method`, `driver`, `phases` but strips `moves`, `scramble`, `seq`.
- `filterStats` in `solveStats.ts` — xIndex-preserving filter on `StatsSolvePoint[]`. No example-bypass (examples are already stripped by `buildStatsData`). `filterSolves` retained for sidebar (keeps example-bypass logic).
- `windowStats` in `trends.ts` — `slice(-N)` on `StatsSolvePoint[]`, xIndex unchanged.
- `buildTotalData` and `buildPhaseData` signatures updated from `SolveRecord[]` to `StatsSolvePoint[]`; both now read `p.xIndex` from input instead of computing `i + 1`.
- `sortAndSliceWindow` deleted — superseded entirely.
- X-axis domain: when zoomed, domain locks to `[currentDomain[0] - 0.5, currentDomain[1] + 0.5]` instead of auto-fitting to visible data.
- Tooltip header changed from `Solve #seq` to `#N` (xIndex position).
- `docs/trends-zoom.md` updated to describe the new four-step pipeline and the filter-vs-sort reset distinction.

**Key technical learnings:**
- `[insight]` Assigning stable identifiers (xIndex) before any filter is applied — and making each pipeline stage a pure pass-through of those identifiers — is structurally superior to recomputing `i + 1` at the end. The invariant becomes impossible to break by construction rather than by convention. The test strategy that pins this: directly construct `StatsSolvePoint[]` with non-sequential xIndex values (100/200/350) and assert they come through `buildTotalData` and `buildPhaseData` unchanged.
- `[insight]` Separating `filterSolves` (sidebar, example-bypass) from `filterStats` (chart pipeline, no bypass) reflects that the two callers have legitimately different semantics. `filterSolves` needs examples to always appear in the sidebar regardless of the active method filter. `filterStats` never sees examples because `buildStatsData` already stripped them when assigning xIndex. A single function with a flag parameter would have hidden this distinction.
- `[note]` The x-axis domain lock ("when zoomed, use zoom range; otherwise auto-fit to visible data") is a two-line change but a meaningful UX decision: filter changes are "look through the same window" operations, not "move the window" operations. Locking makes this explicit.

---

## v1.29.1 — Trends zoom URL persistence + dev handle (2026-04-23 10:15)

**Review:** not yet

**What was built:**
- Chart zoom persists across modal-close, tab-reload, and fresh-tab URL paste. Encoded as `zoom=a,b|c,d|...` in the `#trends` hash (pipe-separated drill-down stack).
- `TrendsHashParams.zoom: Array<[number, number]>` with `parseZoomStack` and `serializeZoomStack` helpers in `useHashRouter.ts`. Malformed / reversed ranges are silently dropped. Round-trip tested.
- `zoomStack` initializes from `initialParams.zoom`; URL-sync effect serializes it back (param omitted when stack is empty).
- Zoom reset moved from `useEffect([windowSize, sortMode])` to `changeWindowSize` / `changeSortMode` callbacks — the effect path fired on StrictMode's simulated unmount-remount and wiped URL-hydrated zoom on first render.
- `window.__solves` + `window.__solveState` exposed via `useSolveStore` in dev mode (gated on `import.meta.env.DEV`). Documented in `docs/debug-mode.md`.
- `future.md` bug: zoom uses positional `xIndex`, so switching method/driver filter while zoomed makes the chart look empty. Deferred — desired semantics is zoom survives method/driver changes, still resets on sort/window change.
- 8 new `useHashRouter` tests (parse empty / single / stack / malformed; serialize empty / single / stack; round-trip).

**Key technical learnings:**
- `[insight]` Effect-based "reset on dep change" is structurally incompatible with hydrating state from props (URL, localStorage, etc.) under React 19 StrictMode. The first mount's effect fires, the ref guard flips, then StrictMode simulates an unmount/remount — refs persist, so the guard is already tripped and the effect wipes the hydrated state. The robust pattern is to move the reset to the user-action handler, tying the side-effect to intent rather than to a React lifecycle event.
- `[gotcha]` The console-log pass confirmed this with line-by-line output: `MOUNT → reset skipped (firstMount=true) → URL-sync writes zoom → UNMOUNT → MOUNT → reset CLEARS (firstMount=false) → URL-sync writes without zoom`. Without the logs the failure looked like "URL just doesn't persist," which mis-points toward the router/history stack.
- `[note]` `window.__solves` sidesteps React DevTools Fiber traversal (which broke on this Vite 19 build — `__reactContainer$` / `__reactFiber$` keys were missing from `document.body`). A single-line dev handle in a React hook beats a generic "find the component via fiber" script for repeat inspection.

**Process learnings:**
- `[insight]` When the user's symptom description and the code both look consistent with the "fix" in place, add tracer logs before changing more code. The URL hash looked right on zoom, the test passed, type-check was clean — the bug was in a dep array I hadn't reconsidered. Logs made the StrictMode double-mount visible in five seconds.

---

## v1.29.0 — Trends sort-by-timestamp toggle (2026-04-23 07:48)

**Review:** complete
**Design docs:**
- Sort-by-timestamp: [Spec](superpowers/specs/2026-04-23-sort-by-timestamp-design.md) [Plan](superpowers/plans/2026-04-23-sort-by-timestamp.md)

**What was built:**
- Sort dropdown (Seq / Date) in the TrendsModal header — toggles whether chart data is ordered by solve sequence number or by completion date
- `sortAndSliceWindow(solves, window, sortMode)` in `trends.ts` — single entry point that filters examples, sorts by the chosen mode, and slices to the rolling window
- `buildTotalData` / `buildPhaseData` refactored to accept a pre-windowed `SolveRecord[]` (no longer sort/filter internally)
- `seq` renamed to `xIndex` on `TotalDataPoint` / `PhaseDataPoint` interfaces — positional chart index, not the solve's human-readable seq number
- `sortMode: SortMode` added to `TrendsHashParams` and `parseTrendsParams` — deep-linkable via `sort=seq|date`
- `sortMode` state in `TrendsModal` initialized from URL, synced back to hash, zoom resets on toggle
- Unit tests: 5 new `sortAndSliceWindow` tests; 2 new `buildTotalData` date-sort tests; 1 new `buildPhaseData` date-sort test; 4 new `useHashRouter` sortMode tests

**Key technical learnings:**
- `[insight]` Computing the windowed array once per render (in `sortAndSliceWindow`) instead of inside each build function eliminated up to 4 redundant sort+slice passes per render — the refactored API makes the single-pass invariant structurally enforced rather than a convention
- `[gotcha]` Renaming `seq` on data-point interfaces to `xIndex` was necessary to avoid a semantic collision: `SolveRecord.seq` is the human-readable solve number (shown in the sidebar, stable across sorts), while the chart position index changes with sort mode — using the same name would have caused subtle display bugs in tooltips
- `[note]` `sortAndSliceWindow` decouples sort order from data transform: `buildTotalData`/`buildPhaseData` assign `xIndex: i + 1` starting at 1 over whatever order they receive, so Ao5/Ao12 rolling averages correctly reflect the chosen sort order

---

## v1.28.0 — Import source badge (2026-04-22 17:01)

**Review:** complete
**Design docs:**
- Import source badge: [Spec](superpowers/specs/2026-04-22-import-source-badge-design.md) [Plan](superpowers/plans/2026-04-22-import-source-badge.md)

**What was built:**
- New "Imported from {source}" pill in `SolveDetailModal`'s header — gated on `localSolve.importedFrom`, renders next to the `Solve #N` / "Example Solve" title
- Title span wrapped in a flex container so the pill sits inline with the title; outer `solve-detail-header` `space-between` row is untouched (LinkedIn pill + close button stay on the right)
- Muted blue palette (`#1a2a3a` bg, `#2a4a6a` border, `#6ab0e8` text) distinguishes provenance info from warning/error hues used elsewhere in the header
- Two component tests in `tests/components/SolveDetailModal.test.tsx` — with and without `importedFrom` — mock `CubeCanvas` so jsdom doesn't try to initialize WebGL
- Docs caught up in the same cycle: `docs/import-data.md` caveat replaced, `docs/ui-architecture.md` note appended, `docs/manual-test-checklist.md` gained a `4e. Import badge` subsection

**Key technical learnings:**
- `[note]` In jsdom, Three.js blows up on module load when `CubeRenderer` instantiates a WebGL context. Mocking `CubeCanvas` to a plain stub short-circuits the renderer-dependent effects cleanly — no need to mock Three.js itself
- `[note]` When narrowing an optional object inside JSX via `{obj && (<...>{obj.field}</...>)}`, TypeScript narrows `obj` correctly inside the render branch — no `!` assertion or `?.` needed

**Process learnings:**
- `[insight]` For a small UI-only change that's really a single conditional `<span>`, the spec + plan + review flow still earned its keep: spec pinned the exact style values, plan made them byte-for-byte reproducible, and the code reviewer caught one minor test-tightening opportunity. For changes this small the overhead is noticeable relative to the code, but the artifacts compound — the style table and placement rule are now reference docs for any future header-pill additions

---

## v1.27.0 — Resequence scope panel (2026-04-21 12:48)

**Review:** not yet
**Design docs:**
- Resequence Scope Panel: [Spec](superpowers/specs/2026-04-21-resequence-scope-preview-design.md) [Plan](superpowers/plans/2026-04-21-resequence-scope-panel.md)

**What was built:**
- New `<ResequenceScopePanel>` in debug mode — replaces the bare `confirm()` renumber button with a panel that previews scope (total count, first-mismatch cursor, renumber count) before the user commits
- State machine: `idle → ready → committing → committed`, auto-resets to idle after 3 s
- New pure helper `previewRenumberScope` — synchronous in-memory scan; shares the same sort + filter logic as `renumberSolvesInFirestore` so preview count and commit count agree by construction
- `renumberSolvesInFirestore` updated to tail-only semantics: preserves earlier solves before the first `seq` mismatch; only renumbers the tail slice; counter update runs after all writes (crash-safety)
- New `<DebugPanel>` shell component — shared box/title/warning chrome extracted from `<RecomputePhasesPanel>`; disabled path dims children with `opacity: 0.5, pointerEvents: none` and shows a hint
- `<RecomputePhasesPanel>` refactored onto `<DebugPanel>` with no behavior change
- Panel is disabled (with hint) when cloud sync is off

**Key technical learnings:**
- `[insight]` Tail-only semantics are safer than full-list renumber for users with imported solves: find the first mismatch index, then only touch the tail — earlier rows with non-1..n seq are preserved
- `[insight]` Crash-safety ordering: counter update runs after `bulkUpdateSolvesInFirestore` resolves (not in a `Promise.all`) — if writes reject partway, the counter isn't advanced past writes that didn't happen
- `[note]` `seq?: number` is optional, so `s.seq !== i + 1` is `true` when `seq` is `undefined` — old imported solves without a seq get correctly renumbered; the behavior is implicit so worth a test or comment if this path is real-world
- `[note]` `previewRenumberScope` is pure with no I/O, making it trivially testable; the shared sort + filter logic with `renumberSolvesInFirestore` means preview count and commit count agree for the same snapshot

---

## v1.26.0 — Shared solve store (2026-04-21)

**Review:** not yet
**Design docs:**
- Solve Store: [Spec](superpowers/specs/2026-04-20-cache-solves-across-toggles-design.md) [Plan](superpowers/plans/2026-04-20-cache-solves-across-toggles.md)

**What was built:**
- New module-level `solveStore` with `useSyncExternalStore`; replaces `useSolveHistory`
- `TimerScreen`, `AcubemyImportModal`, `RecomputePhasesPanel`, debug-mode handlers all read from the store
- Debug-mode "Refresh solves" button backed by `solveStore.reload()`
- `addMany` chunk-of-100 `Promise.allSettled` bulk insert with optimistic rollback on failure
- `runBulkOp` helper wraps server-side maintenance operations and reloads the store afterward
- Pure `computeAo` / `computeStats` / `filterSolves` moved to `src/utils/solveStats.ts`
- First use of `vi.mock` for `firestoreSolves` in the project

**Key technical learnings:**
- `[insight]` Module-level state + `useSyncExternalStore` cuts ~100 lines of state management out of `TimerScreen` and eliminates all debug-mode duplicate Firestore reads, without pulling in a state library.
- `[note]` `Promise.allSettled` per chunk (vs `Promise.all`) was necessary to keep partial-failure reporting aligned with the existing `migrateSolvesToV2InFirestore` pattern.
- `[gotcha]` `configure()` must be idempotent by `(enabled, uid)` tuple — otherwise StrictMode's double-invoke re-migrates on mount.

---

## Meta — session cost analysis tooling (2026-04-21)

**Review:** not yet

**What was built:**
- `scripts/cost_extract.py` — extracts token usage and cost from a single Claude Code session JSONL. Accepts a session name (from `/rename`) or a file path; auto-discovers subagent JSONLs from `<session-uuid>/subagents/`; outputs a token breakdown table (stable across rate card changes) and a cost estimate.
- `docs/cost-analysis.md` — temporary reference doc for the script; marked for removal once extended into a Claude skill.
- `CLAUDE.md` — two new sections: **Session Cost** (run the script for any one-off cost query) and **Feature Cost Tracking** (run once per phase after shipping a feature, save results to `articles/cost-<feature-name>.md`).
- `future.md` — new `## Tooling` section with item to extend the script into a Claude skill.

**Key technical learnings:**
- `[gotcha]` Claude Code session JSONLs have two representations of cache write tokens: `cache_creation_input_tokens` (plain integer = total) and `cache_creation.ephemeral_5m/1h_input_tokens` (tier breakdown). Using both causes double-counting. Use only the `cache_creation` dict.
- `[insight]` `cache_creation_input_tokens` as a plain integer being the sum of tiers is not documented anywhere obvious — discovered by comparing the two fields event-by-event and seeing they were always equal.
- `[gotcha]` Sessions renamed mid-way via `/rename` have an early run of `custom-title` events with the old name, then new ones with the new name. Name lookup must scan the full file and use the **last** `custom-title` event.
- `[insight]` Subagent JSONLs live at a predictable path — `<session-uuid>/subagents/*.jsonl` collocated with the main session file — so no manual path input is needed; auto-discovery always works.
- `[insight]` Opus main-loop sessions write to the 1h cache tier; subagents write to the 5m tier. Both tiers are explicitly named in the JSONL (`ephemeral_1h_input_tokens` / `ephemeral_5m_input_tokens`), so there is no ambiguity.
- `[gotcha]` The 1h cache write rate for Opus 4 is $30/MTok (2× input), not $75 (which would be the output rate). Using the output rate inflates cost estimates by 2.5×.

---

## v1.25.0 — bulk recompute phases (2026-04-20 21:19)

**Review:** not yet

**Design docs:**
- Bulk Recompute Phases: [Spec](superpowers/specs/2026-04-20-bulk-recompute-phases-design.md) [Plan](superpowers/plans/2026-04-20-bulk-recompute-phases.md)

**What was built:**
- `src/utils/recomputeAllPhases.ts` — pure scanner returning `{unchanged, changed, failed, skipped}`. Skips `isExample` and `method === 'freeform'`; bucketing relies on a `phasesEqual` deep compare across `label / group / recognitionMs / executionMs / turns`.
- `src/components/RecomputePhasesPanel.tsx` — inline debug panel: dry-run scan → bucket counts (with inline legend explaining each) → up to 5 sample changed rows showing per-phase turn counts + deltas (e.g. `Cross 7 steps(-1)`), filtered to changes with a turn-count diff (time-only changes still get committed but are rarely interesting to review) → failed solve ids → commit only changed + successfully-recomputed solves. Solve ids in both sample rows and failed list are clickable, opening the solve detail modal via an injected `onSolveClick` callback. Self-contained `useState` FSM (`idle / scanning / results / committing / committed`), parent injects `loadSolves` and `commitChanges` callbacks so the same component drives both stores. Cancel returns to idle from the dry-run; Scan button shows `Loading...` while fetching.
- `src/services/firestoreSolves.ts` — `bulkUpdateSolvesInFirestore(uid, solves, onProgress)`; chunked `Promise.all(setDoc)` at 100 per chunk; emits `onProgress(0, batchCount)` before any writes (so the panel can render `batch 0 of N` immediately) plus `onProgress(i+1, batchCount)` after each chunk completes. Optimized `renumberSolvesInFirestore` to only write docs whose `seq` actually changes (counter doc still updated unconditionally — cheap single write).
- `src/App.tsx` — single mount per feature (one `<RecomputePhasesPanel>` and one **Detect method mismatches** button) in the maintenance toolbar, branching on `cloudSync.enabled && cloudSync.user` to target Firestore vs localStorage. Label updates dynamically.
- Docs: `debug-mode.md` updated; `future.md` got an item to investigate why Firestore solves seem to reload on each debug/timer toggle.

**Key technical learnings:**
- `[note]` Firestore `writeBatch(500)` would exceed the 10 MB payload limit at our ~35 KB per solve; chunked `Promise.all(setDoc)` at 100 per chunk is the right pattern and matches existing bulk handlers in `firestoreSolves.ts` (`renumberSolvesInFirestore`, `recalibrateSolvesInFirestore`, `migrateSolvesToV2InFirestore`).
- `[insight]` Failed recomputes (moves don't replay to solved) are surfaced but excluded from commit — writing anything back on a solve whose own moves don't replay would compound bad data. The dry-run UI shows failed ids so the user can investigate them individually instead.
- `[gotcha]` Computing per-phase deltas from raw millisecond values and *then* rounding for display produces phantom `(-0.0s)` artifacts when both rounded values are identical but their unrounded sources differ. The fix is to round *first*, then subtract — the diff must be derived from the values the user actually sees. (We then dropped time from the sample rows entirely in favor of just turn-count + delta, which sidestepped the issue and matched the data the user actually cares about.)
- `[insight]` Progress callbacks should fire once before the first batch with `(0, total)` so the UI can render meaningful state during the gap between "user clicked Commit" and "first batch finished writing". Otherwise the panel renders `batch 0 of 0` (initial seed) and only updates after the first chunk completes — which on 100 cloud writes is several seconds of staring at a wrong number.

**Process learnings:**
- `[note]` Extracting the panel out of `App.tsx` (unlike the v1.9 mismatch scanner which is inlined) kept `App.tsx` from growing further — pattern to prefer for new debug panels. Injecting `loadSolves` / `commitChanges` / `onSolveClick` callbacks let one component cover both storage backends without branching internally and stay decoupled from routing.
- `[insight]` Initial design mounted the panel twice (cloud sync block + maintenance toolbar), mirroring the v1.9 method-mismatch button. After SansWord asked to consolidate, both panels collapsed into a single mount that branches on cloud-sync state with a dynamic `(Firestore | localStorage)` label. Worth applying the same pattern to method mismatches in the future — done in this same session.

---

## v1.24.1 — Roux center drift + rotation invariance (2026-04-20 15:17)

**Review:** not yet

**What was built:**
- Extracted `src/utils/cubeGeometry.ts` — face centers, `FACE_POSITIONS`, `OPPOSITE`, `EDGES`, `CORNERS` tables, plus `edgesOnFace` / `cornersOnFace` / `findFaceWithColor` helpers. Previously inlined in `cfop.ts`; now consumed by both `cfop.ts` and `roux.ts`.
- `isFirstBlockDone` / `isSecondBlockDone`: detect 1×2×3 blocks by comparing main-color to the block face's **live center** and long-color to hardcoded `'Y'`. The long-Y stickers stay on the block across M/E/S even though the Y center drifts away — that's the drift-invariant identity of the block. Pair-consistency between the long edge and its corners handles the now-unlabeled perpendicular faces.
- `isCMLLDone`: reorient first, then dispatch to `isUCMLLDone` / `isDCMLLDone` / `isFCMLLDone` / `isBCMLLDone` based on the block's long face (CMLL face = `OPPOSITE[longFace]`). After reorient, blocks sit on L/R, so long face can be any of U/D/F/B. Each variant uses color equality (`f[a] === f[b]`) rather than hardcoded `'W'`, so M-drifted states with the correct cubies still pass.
- `isEODone` / `isULURDone`: call `reorientToStandard` first so the remaining hardcoded `'W'` / `'O'` / `'R'` sticker checks are valid under x/y/z. EO also adds an explicit corner-alignment guard on the L/R faces.
- Test suite grew from ~15 to 38 Roux tests. Added `checkRotationInvariant` helper that applies every whole-cube rotation of length ≤ 3 to each predicate — rotated solved is still solved, rotated broken is still broken. Added M-drift tests for FB / SB / CMLL. Replaced toothless `R U R'` CMLL false-positive test with Sune (block-preserving CMLL alg) plus explicit `isSecondBlockDone === true` precondition so short-circuit regressions can't silently pass.
- Rolls up two earlier Roux commits from the same day: `f1e8a63` (relaxed `isCMLLDone` so U-layer doesn't have to sit on original home face) and `e5a6524` (EO corner-alignment guard on L/R).

**Key technical learnings:**
- `[insight]` After M-slice drift the "long face" of a Roux block is whichever face the Y-center currently sits on, not D. So CMLL detection can't dispatch purely on "W is on U" — it has to locate the block's long face dynamically (`isBlockOnFace` loop) and take the opposite. This is a consequence of the Roux block being defined by cubies, not by face colors: the block stays physically intact through M/E/S while the Y center wanders.
- `[insight]` Replacing hardcoded color checks with `f[a] === f[b]` pair equality makes the predicate invariant under drift AND U-layer scrambling. The 4 CMLL-face corner stickers are all the same color when CMLL is done — whatever that color happens to be — so equality checks survive both center drift and AUF (U-layer moves that permute the corners without breaking them).
- `[gotcha]` A regression test for "blocks complete + CMLL scrambled" using `R U R'` is toothless: `R` breaks SB, so `isSecondBlockDone === false` short-circuits before the CMLL check ever runs. Use a block-preserving CMLL alg (Sune: `R U R' U R U2 R'`) to get both blocks intact AND U-layer permuted. Always assert the precondition (`expect(isSecondBlockDone(f)).toBe(true)`) so the test can't silently regress by triggering the short-circuit.
- `[note]` Rotation-invariance property tests catch a whole class of bugs cheaply — enumerate all 24 whole-cube orientations (or a representative ≤3-length subset) and assert `fn(rotated) === fn(base)` for both `true` and `false` baselines. Much stronger than spot-checking `fn(x(solved))`.
- `[gotcha]` Center drift after slice moves is NOT the same as drift after whole-cube rotations. `reorientToStandard` only undoes the latter (moves W back to U, G back to F via x/y/z). M/E/S drift leaves centers in a state that `reorientToStandard` can't fix, so block/CMLL predicates still need to tolerate live-center lookups even *after* reorient.

**Process learnings:**
- `[insight]` Code review by a fresh-context subagent caught two issues the main loop had stopped noticing: (1) the toothless regression test described above, (2) a stricter-than-needed guard (`blockOrientation !== 'Y'`) that over-rejected M-drifted states. The main loop was primed by the intricate block-detection work and treated "current CMLL dispatch goes only to U-face" as acceptable — fresh eyes immediately asked "why not dispatch to whichever face is opposite the long face?"

---

## v1.24.0 — CFOP center drift tolerance (2026-04-20 11:58)

**Review:** not yet

**What was built:**
- Relaxed the CFOP phase predicates in `src/utils/cfop.ts` to tolerate center drift under M/E/S slice moves and whole-cube x/y/z rotations. Previously each predicate assumed Y sits on D and W sits on U; now each one looks up the target color's current face index via `findFaceWithColor(f, color)` and compares adjacent-face stickers against the **live center color** of that face (`f[ctr]`) instead of hardcoded letters.
- `isCrossDone`: Y-face is found dynamically; each D-edge checked against `f[ctr]` for its adjacent side.
- `countCompletedF2LSlots`: enumerates the 4 F2L slots as (D-face, side1, side2) corner+edge pairs, filtering out the opposite-side pair. Works regardless of which face Y currently sits on.
- `isEOLLDone` / `isOLLDone` / `isCPLLDone`: W-face is looked up dynamically; sticker checks reference the face's live center color.
- Introduced inline geometry tables (`FACE_CENTERS`, `OPPOSITE`, `EDGES`, `CORNERS`) — these were later extracted to `cubeGeometry.ts` in v1.24.1 and shared with Roux.
- Added rotation-invariance tests: `isCrossDone`, `countCompletedF2LSlots`, `isEOLLDone`, `isOLLDone`, `isCPLLDone` all pass after `x` / `y` / `z` rotations.

**Key technical learnings:**
- `[insight]` The right abstraction for phase detection in a drifted cube is "find the face whose center matches the target color, then compare against live centers," not "pass in a rotation matrix and un-rotate." The cube's facelet positions are spatially fixed; only center colors drift. So the lookup is O(6) and the rest of the logic doesn't care about orientation.
- `[note]` Tests that apply an `x` / `y` / `z` rotation to a solved cube and expect the predicate to still return `true` are a natural fit here — cheap to write, catch any regression that re-introduces a hardcoded color assumption.

---

## v1.23.0 — Acubemy import (2026-04-18 22:26)

**Review:** not yet

**Design docs:**
- Acubemy Import: [Spec](superpowers/specs/2026-04-18-acubemy-import-design.md) [Plan](superpowers/plans/2026-04-18-acubemy-import.md)

**What was built:**
- `importedFrom?: { source: 'acubemy'; externalId: number | string }` field on `SolveRecord` — used as the `(source, externalId)` dedup key.
- `src/utils/acubemyImport/` — `parseRawSolution` (Western color map), `gyroMap` (quaternion field reorder + validation), `verifySolvability` (scramble-token whitelist + final-state check), `parseExport` (orchestrator: file-level validation, dedup short-circuit, per-record classification, preview summary).
- `ColorMoveTranslator.flush()` — drains the pending move synchronously so batch/offline pipelines can use slice pairing without the live fast-window setTimeout.
- `AcubemyImportModal` — file picker → preview table (sorted by date, status column with tooltips) → "Import N (skipping: …)" button → async writing overlay → `window.alert` on success.
- Debug-mode "Import from acubemy" button wired into `App.tsx`; commit handler writes directly to localStorage or Firestore (not via `useSolveHistory`, which is unmounted in debug mode).
- 13-file manual test pack in `tests/fixtures/manual/acubemy/`: covers file-level errors, every parse-error reason, unsolved, unknown method → freeform, malformed gyro → `gyro-dropped` warning, duplicates, happy path.
- `docs/import-data.md` — user guide + internal reference for acubemy's export format and our field mapping.
- Golden fixture test on `example.json` locks the pipeline to 2 importable records with pinned CFOP/Roux shapes (externalIds 388217 and 376615).

**Key technical learnings:**
- `[insight]` `ColorMoveTranslator`'s `FAST_WINDOW_MS` setTimeout couples slice pairing to wall-clock time — fine for live BLE moves but blocks batch import. Exposing a tiny `flush()` that just calls the existing `_flushPending()` decouples fast-window semantics from the event-driven live path without changing live behavior.
- `[note]` `parseScramble` is lenient (first letter = face, ignores suffix shape). The importer validates the scramble token-by-token against `OUTER_FACES × ['', "'", '2']` BEFORE reusing `parseScramble`, so wide moves (`Rw`), rotations (`x`, `y`), and unknown tokens surface as explicit `parse-error` reasons — keeping `parse-error` distinct from `unsolved`.
- `[gotcha]` Firestore doc ID is `String(solve.date)` — cloud-mode bulk imports with historical dates can collide with existing docs. Handler bumps `date += 1ms` in a `while (usedDates.has(date))` loop per draft to guarantee unique IDs before calling `addSolveToFirestore`. Same pattern is NOT needed for localStorage writes since those use a separate `nextId` counter.
- `[insight]` Dedup short-circuit before `parseRawSolution` keeps re-import fast when 100% of rows are duplicates. A spy-based test (`vi.spyOn(__testing, 'parseRawSolution')`) pins this optimization so a future refactor can't silently undo it.
- `[note]` `timeMs` comes from `raw_timestamps[last]`, not the last `PositionMove.cubeTimestamp`. The two can differ when `ColorMoveTranslator` pairs the last two ColorMoves into a slice (slice takes the earlier timestamp). The raw-timestamp value is the solver's actual wall-clock end time; using the paired slice's timestamp would understate the solve.
- `[gotcha]` Acubemy's `gyro_data` uses `{q: {w, x, y, z}, t}` but sans_cube's `quaternionSnapshots` uses `{quaternion: {x, y, z, w}, relativeMs}` — both the field names AND the w/x/y/z ordering differ. `gyroMap` reorders per-sample; a malformed sample (NaN, missing field) flips the whole array to `null` and surfaces as a `gyro-dropped` warning (import proceeds without replay gyro).

**Process learnings:**
- `[insight]` Untrusted external JSON requires two distinct validation layers: presence/emptiness (caught by a required-field loop) AND shape/type (e.g., `solve_id` being a `number | string`, `raw_timestamps` being `number[]`). The first code-quality review flagged that presence alone would let `{solve_id: "abc"}` through to downstream `as number` casts, producing a silently-corrupt `SolveRecord`. Typed locals produced by runtime `typeof`/`Number.isFinite` checks are the fix — then the casts disappear.
- `[note]` In subagent-driven development, asking the implementer to "commit in the feature worktree" was not enough — one subagent still committed to main. Prefix every Bash call with `cd /path/to/worktree &&` in the subagent prompt (and have them verify branch first) to prevent misdirection.

---

## v1.22.1 — URL write effect mount-time guards (2026-04-17 16:47)

**Review:** not yet

**What was built:**
- Fixed: visiting `#solve-{id}` directly with cloud sync disabled caused the detail modal to blink on/off every frame. The "Write URL for selectedSolve" effect in `TimerScreen.tsx` ran in the same render as the boot-resolve effect, saw `selectedSolve` still `null` (React batches state updates — siblings don't see each other's `setState`), and entered the `else` branch that unconditionally wiped the hash + called `navigate({type:'none'})`. The next render's react-to-route effect then reopened the solve from the restored URL, and the cycle repeated indefinitely.
- Fixed: direct `#shared-{id}` links required two back presses to leave. After Firestore returned, the effect always called `pushState(#shared-{id})` — even when the URL already matched — creating a duplicate history entry.
- Extracted both URL-write decisions to pure helpers in `useHashRouter.ts`: `decideSelectedSolveUrlAction` and `decideSharedSolveUrlAction`. Each returns a tagged `noop` / `open-push` / `open-replace` / `clear` / `restore-trends` action; `TimerScreen.tsx` now dispatches on the tag. 12 new test cases cover every branch.

**Key technical learnings:**
- `[gotcha]` State updates from one `useEffect` are **not** visible to sibling effects in the same commit — they all read the render's snapshot. A write-URL effect running alongside a "set state from URL" effect will see the stale (unset) state and can erroneously clear the URL. Guard the mount case with `prev === null && current === null → noop`, not by relying on a ref that a sibling effect may not have written yet.
- `[insight]` `pushState` to a hash that already matches the target is still a real history entry. Boot-time "open modal from URL" flows should `replaceState` when the current hash matches the target and `pushState` only when it differs. The sibling `sharedSolve` effect's `prev &&` guard prevented clear-on-mount but never considered the hash-already-matches case, so direct shared-link loads quietly accumulated duplicate entries.
- `[note]` Extracting branch logic to `decide{X}UrlAction` pure functions mirrors the existing `parseHash` pattern — DOM side effects stay in the effect, the decision is unit-testable in isolation. Made the symmetry between the two effects visible: same shape of action type, same mount-time noop guard.

---

## v1.22.0 — Freeform method (2026-04-17 12:02)

**Review:** not yet

**Design docs:**
- Freeform Method: [Spec](superpowers/specs/2026-04-17-freeform-method-design.md) [Plan](superpowers/plans/2026-04-17-freeform-method.md)

**What was built:**
- New `FREEFORM` solving method (`src/methods/freeform.ts`) with a single `Solved` phase that completes when the cube reaches the solved state.
- Wired into `MethodSelector` (Detail modal), `SolveHistorySidebar` filter, `TrendsModal` filter + color map, and `useHashRouter` URL whitelist (`#trends?method=freeform`).
- `recomputePhases` handles Freeform via the existing generic algorithm — no changes to the recompute core needed.
- `detectMethodMismatches` skips Freeform solves so they are not flagged in the maintenance panel.

**Key technical learnings:**
- `[note]` A method with a single phase whose `isComplete` is `isSolvedFacelets` round-trips cleanly through `recomputePhases`: `turns === moves.length`, `recognitionMs === 0`, `executionMs === lastTs - firstTs`.
- `[insight]` Adding a new method is a union-widening + registry operation across ~6 files, not a schema change. The `method` field on `SolveRecord` is already a free-form `string`; widening `MethodFilter` is the type-level work, and each consumer (`MethodSelector`, filter dropdowns, hash router) is a local edit.
- `[gotcha]` `TrendsModal.buildColorMap('all')` spreads method color maps in order — if two methods share a label, last-wins. Freeform's `Solved` label does not collide with CFOP or Roux, so order is safe. Future methods adding a label like `EPLL` would collide with CFOP.
- `[gotcha]` `detectMethodMismatches` reads `solve.isExample` and skips them — so tests written against `CFOP_SOLVE_1` (which is an example fixture) pass vacuously unless you override `isExample: false`. The skip-guard test would silently pass without exercising the actual code path.

---

## v1.21.1 — Commutative ahead execution (2026-04-17 10:15)

**Review:** not yet

**Design docs:**
- Commutative Ahead: [Spec](superpowers/specs/2026-04-17-commutative-ahead-design.md) [Plan](superpowers/plans/2026-04-17-commutative-ahead.md)

**What was built:**
- When two adjacent scramble steps are on opposite faces (R↔L, U↔D, F↔B), the user can execute the next step before the current one
- Ahead step turns green (`aheadState: 'done'`) when done correctly, orange (`aheadState: 'warning'`) when done in the wrong direction
- Completing the current step while ahead is done skips the already-done step (advances by 2)
- Completing the current step while ahead is in warning transfers the warning state to the new current step seamlessly
- Look-ahead limited to one step ahead only; slice moves (M/E/S) are never eligible; no changes to `ScrambleDisplay` or `solve.ts`

**Key technical learnings:**
- `[insight]` Two orthogonal state axes — `trackingState` for the current step and `aheadState` for the ahead step — allow both to progress and warn independently without entangling each other. The ahead face routes to `applyAheadMove`; any third face enters wrong mode as normal.
- `[insight]` When the current step fulfills while `aheadState === 'warning'`, the net turns transfer directly: `warningNetTurns = aheadNetTurns`. The orange ahead step seamlessly becomes an orange current step with no visible reset.
- `[gotcha]` The bounds guard (`currentStepIndex + 1 < steps.length`) must be checked before calling `commutes()` — not after — to avoid an out-of-bounds array access on `steps[currentStepIndex + 1]`.
- `[note]` Same-face sequences (e.g. `R R`) are never eligible for ahead execution because `commutes('R', 'R')` returns false. Current step always has priority — the ahead branch only fires when `move.face !== steps[currentStepIndex].face`.

---

## v1.21.0 — Scramble undo (2026-04-17 02:47)

**Review:** not yet

**Design docs:**
- Scramble Undo: [Spec](superpowers/specs/2026-04-17-scramble-undo-design.md) [Plan](superpowers/plans/2026-04-17-scramble-undo.md)

**What was built:**
- Undo completed scramble steps by doing the inverse move (R' undoes R, L' undoes L) while in `scrambling` state
- Double-step undo (U2): any move on the same face enters warning mode; two same-direction moves undo it (white), one of each direction re-completes it (green)
- Undo is chainable — multiple consecutive undos walk back through completed steps
- Armed state (scramble fully done) ignores all moves including undo-like ones — no change to existing behaviour

**Key technical learnings:**
- `[insight]` Double-step undo reuses the existing `warning` state with no new flags: pre-decrement `currentStepIndex` before entering warning, then seed `warningNetTurns = 2 + delta` (where delta = ±1 from the trigger move direction). The existing `net4=0` (cancel) and `net4=2` (advance) paths then produce exactly the right undo/re-complete outcomes without any changes to the warning resolver.
- `[gotcha]` Seeding at `2` (not `2 + delta`) was the initial plan — it's wrong. The trigger move's direction must be folded in (same pattern as normal double-step entry), otherwise it takes 3 moves instead of 2 to resolve the undo.
- `[note]` Undo only triggers when `move.face !== expected.face` — so if the current step and previous step share the same face, forward takes priority and undo is unreachable. Scramble generators avoid consecutive same-face moves, so this edge case doesn't arise in practice.

## v1.20.1 — URL routing bug fixes (2026-04-16 23:54)

**Review:** not yet

**What was built:**
- Fixed: visiting `#solve-{id}` directly left modal stuck (ESC and close button did nothing) — `history.replaceState` doesn't fire `popstate`/`hashchange`, so `currentRoute` was never updated after the URL write. Fix: call `navigate()` after every `pushState`/`replaceState` in `TimerScreen`'s URL write effects.
- Fixed: rapid blink (modal open/close loop) when pressing ESC on a directly-visited `#solve-{id}` — Firestore periodically re-emits new `solves` array references without data changes; having `solves` in the reactive effect's deps caused the modal to re-open after close. Fix: `solvesRef` pattern (ref synced on every render, not in deps).
- Fixed: `#shared-{id}` URL not clearing when ESC pressed before cloud load finished — `urlResolvedRef` guard was blocking the clear path. Fix: replaced with `prev !== null` guard so close always clears.
- Fixed: clicking a solve inside TrendsModal didn't update URL to `#solve-{id}` — early return `if (showTrends) return` blocked the write. Fix: save trends hash to `savedTrendsHashRef` on open, restore on close; use ref so trends hash survives `setShowTrends(false)` from the reactive effect.
- Fixed: `#trends` URL blinks open then immediately closes — `showTrends` was in the selectedSolve URL write effect deps; when trends opened (`setShowTrends(true)`), the effect re-fired, saw `selectedSolve=null` + empty `savedTrendsHashRef`, and called `navigate({type:'none'})`. Fix: read `showTrends` via `showTrendsRef` and remove it from deps.
- `TrendsModal` onClose now calls `navigate({type:'none'})` to keep `currentRoute` in sync with the cleared URL.
- Modal overlay opacity reduced from 0.85 to 0.55.

**Key technical learnings:**
- `[gotcha]` `history.pushState`/`replaceState` do **not** fire `hashchange` or `popstate`. After any manual URL write you must also call `navigate()` to sync React router state — otherwise `currentRoute` is stale and close/back handlers can't work.
- `[gotcha]` Firestore listeners periodically re-emit new array references with identical data. Any effect with the array in deps will re-fire on these no-op updates. Use the ref pattern (`arrayRef.current = array`, read ref inside effect, omit array from deps) for effects that must not re-run on Firestore noise.
- `[insight]` **Trigger vs. reader rule for effect deps**: deps are triggers — values whose changes should re-run the effect. Values the effect only reads as guards (`if (x) return`) belong in refs, not deps. The heuristic: if the first thing the effect does with a dep is an early return, that dep is a reader, not a trigger.
- `[gotcha]` A reactive effect that calls `setShowTrends(false)` when `currentRoute` becomes `solve` means `showTrends` is already `false` by the time the user presses ESC. Don't use `showTrends` as a signal for "currently in trends context" — use a dedicated ref (`savedTrendsHashRef`) set at the moment of navigation.

---

## v1.20.0 — hash router consolidation (2026-04-16 21:04)

**Review:** not yet

**Design docs:**
- Hash Router: [Spec](superpowers/specs/2026-04-16-hash-router-design.md) [Plan](superpowers/plans/2026-04-16-hash-router.md)

**What was built:**
- **`useHashRouter` hook** (`src/hooks/useHashRouter.ts`): single `hashchange` + `popstate` listener, `parseHash` pure function, `Route` discriminated union (`debug` | `solve` | `shared` | `trends` | `none`), `TrendsHashParams` type moved here from `TrendsModal`.
- **`App.tsx`**: removed own `hashchange` listener; calls `useHashRouter()` once; passes `currentRoute` prop to `TimerScreen`; `#debug` toggle switches to `replaceState`.
- **`TimerScreen.tsx`**: accepts `currentRoute` prop; removed own `hashchange` listener; boot resolution uses typed route instead of raw hash; `pushState` on solve/shared modal open (was `replaceState`); context-aware close; `initialParams` passed to `TrendsModal`.
- **`useSharedSolve.ts`**: accepts `currentRoute` parameter; removed boot effect and hashchange listener; reacts to `currentRoute.type === 'shared'`; removed race-condition workaround (`replaceState` in `doLoad`).
- **`TrendsModal.tsx`**: accepts `initialParams: TrendsHashParams`; removed `parseHashParams()` init; `pushState` on first open, `replaceState` for param updates; `detailOpen` guard prevents overwriting `#solve`/`#shared` URL.
- **12 unit tests** for `parseHash` covering all route types, invalid inputs, and param edge cases.
- **`docs/url-routes.md`** updated to document the new architecture, write strategy table, and boot resolution rules.

**Key technical learnings:**
- `[insight]` `pushState`/`replaceState` do **not** fire `hashchange` or `popstate` — so write-backs from components never re-trigger the router. No loop risk.
- `[insight]` `#shared` does not need to wait for `cloudLoading` — it fetches a single public Firestore document and is independent of user data or auth state. `#solve` and `#trends` do wait.
- `[gotcha]` The old `useSharedSolve` had a race condition: `TimerScreen`'s URL-sync effect could call `replaceState('')` while the shared solve fetch was still in-flight, clearing `#shared-{id}` from the URL. The fix was removing that write-back from `doLoad` and letting `TimerScreen`'s `sharedSolve` effect own the URL instead.
- `[insight]` `TrendsModal`'s `isFirstMountRef` distinguishes first render (→ `pushState`, adds a history entry so back button works) from subsequent param updates (→ `replaceState`, no history accumulation on filter changes).
- `[note]` `detailOpen` guard in `TrendsModal`'s URL sync effect prevents it from overwriting `#solve` or `#shared` while a detail modal is open on top of trends.

---

## v1.19.4 — replay gyro orientation correction (2026-04-16 18:22)

**Review:** not yet

**What was built:**
- **FSM correction in replay** (`useReplayController`): added `computeReplayFsmState` (walks `solve.moves[0..currentIndex)`, advances FSM state on each M/E/S) and `applyFsmCorrection` (`rawQ * inv(fsmOffset)`). Applied at all three gyro update paths: normal RAF update, post-animation settle, and `seekTo`.
- **`docs/animation-system.md` updated**: Gyro Animation section now documents the FSM correction step, index-based walk rationale, and render-time-only policy.

**Key technical learnings:**
- `[insight]` FSM state reconstruction for replay should be **index-based**, not time-based — FSM transitions only fire on M/E/S moves, and `currentIndexRef.current` (for the RAF loop) and `clamped` (for `seekTo`) give the exact move count directly, avoiding a timestamp binary search.
- `[note]` Raw `quaternionSnapshots` store `q_sensor` — correction is applied at render time only, so stored data never needs migration for this fix.
- `[note]` Implemented in a git worktree (`.worktrees/replay-gyro-fix`) to allow side-by-side comparison of main vs. feature branch during review.

---

## v1.19.3 — per-solve migrate button + shared solve owner detection (2026-04-16)

**Review:** not yet

**What was built:**
- **"Migrate to v2" button** in the orange warning banner (`SolveDetailModal`): runs `migrateSolveV1toV2` on demand, saves the result via `onUpdate` if the cube is solved after correction, otherwise shows an inline error. Loading state prevents double-clicks.
- **Debug migration log enriched**: status line now appears at the top — `✓ Migration would SUCCEED` or `✗ Migration would FAIL` — followed by phase diff details (`⚠ Phase differences after migration: …`) or `✓ No phase differences` when phases match exactly.
- **Unified "Mark reviewed" action**: previously the `migrationNote` banner's "Mark reviewed" only cleared `migrationNote`, and the migration review section's "Mark as reviewed" only cleared `movesV1`. Both now clear both fields in one write.
- **Migration banners hidden for shared (readOnly) viewers**: `showMigrationWarning`, `showSchemaVersionBump`, and `migrationNote` banners are all suppressed when `readOnly`. A minimal read-only inaccuracy notice (no buttons) is shown instead for v1+M/E/S shared solves.
- **Shared solve owner detection** (`firestoreSharing.ts`, `TimerScreen.tsx`): `isSharedSolveOwner(uid, shareId)` does a single `getDoc` on `users/{uid}/shared_solves/{shareId}`. O(1) — a registry doc exists iff the user owns the share. Result stored in `sharedSolveIsOwned` state; owner sees full modal (migrate/review/unshare buttons, working `onUpdate`/`onDelete`); non-owner gets `readOnly`.

**Key technical learnings:**
- `[insight]` **Firestore ownership check by path is O(1) regardless of collection size.** `getDoc` on a known path is a direct key lookup — no scan. Safe even if a user has millions of shared solves.
- `[gotcha]` **Two separate "Mark reviewed" buttons were each clearing only their own field**, leaving the other stale. Whenever a review action semantically clears a "pending review" state, it should clear all related fields in one write. Here: `movesV1` and `migrationNote` are always cleared together.

---

## v1.19.2 — migration debug UX + relaxed invariant + solve list color coding (2026-04-16)

**Review:** not yet

**What was built:**
- **Null `cubeTimestamp` guard** (`useReplayController`, `recomputePhases`): M-pair moves retroactively inserted during v2 migration have `null` timestamps. Both replay scheduling and phase timing now fill nulls with the nearest prior valid timestamp, preventing NaN propagation and stalled playback.
- **`correctMovesV1toV2` exported** (`migrateSolveV1toV2.ts`): extracts the center-tracking move correction loop into a standalone function reusable outside the migration invariant path.
- **Fully relaxed migration invariant**: migration now succeeds as long as the corrected moves solve the cube (`freshPhases !== null`). Phase count, labels, turns, and timing differences are logged as a diff summary but no longer block migration.
- **`migrationNote?: string`** added to `SolveRecord`: when phases differ between v1 and fresh recomputed values, the per-phase diff is stored in the record and persisted (localStorage + Firestore). Cleared by user on review.
- **"Debug migration" button** in `SolveDetailModal` unmigrated warning banner: intercepts `console.warn`, runs `migrateSolveV1toV2`, then calls `correctMovesV1toV2` to list every face-label change (index, serial, old→new). Output shown inline below the button. Full move table in WCA notation with v1/v2 columns, phase separators, and `*` markers on changed rows.
- **`migrationNote` banner** in `SolveDetailModal`: blue block showing the phase diff, with a "Mark reviewed" button that clears the field and calls `onUpdate`.
- **"Stamp v2" banner** in `SolveDetailModal`: shown for v1 solves without M/E/S moves — no corrections needed, just sets `schemaVersion: 2` and persists.
- **Solve list migration color coding** (`SolveHistorySidebar`): time cell colored orange (v1 + M/E/S, migration failed), blue (v1 without M/E/S needing stamp, OR migrated with `migrationNote`), normal (clean v2).
- **Slice move direction correction** (`correctMovesV1toV2`): when a slice changes identity (e.g. S→E after M'), the direction must flip if the original anchor color landed on the opposite side of the new anchor face. Added `SLICE_ANCHOR_COLOR`, `SLICE_ANCHOR_FACE`, `OPPOSITE_FACE` constants and the flip check. Covered by 5 new unit tests.

**Key technical learnings:**

- `[gotcha]` **Null cubeTimestamps propagate as NaN through arithmetic.** M-pair moves inserted retroactively have `null` timestamps. Without guarding, `NaN` enters cumulative delay calculations and stalls replay entirely. Fill nulls with the nearest prior valid timestamp before any arithmetic.
- `[insight]` **Migration invariant was blocking valid migrations.** Correcting M face labels changes the simulated cube state at each step, which can shift phase boundaries and change turn counts and timing. The stored phases (computed with wrong labels) won't match freshly recomputed ones — but both the old and new data are self-consistent. The right signal is just "did the corrected moves solve the cube?" — not "did the phases reproduce exactly?"
- `[insight]` **Extracting the move-correction loop as a separate function pays off immediately.** The debug button needs corrected moves even when migration "fails" (to show what changed). Without `correctMovesV1toV2`, the debug button would have had to duplicate the center-tracking loop.
- `[gotcha]` **Slice move direction is anchored to the color face, not a fixed axis — and it flips when the slice changes identity.** In v1, GAN reports "S CW" meaning CW as viewed from the green face (S's anchor). After M', green is at U. The corrected slice is E, whose anchor is D. U is opposite D, so the direction flips: `S CW → E CCW`. The rule: find where the original anchor color currently is; if it's on the opposite face from the new slice's anchor, flip CW↔CCW. Face moves (U/L/R/F/D/B) don't need this — their CW is always relative to the face itself, which the label correction already handles.

---

## v1.19.1 — EO detection fix + migration invariant + test coverage (2026-04-16)

**Review:** not yet

**What was built:**
- **`isEODone` split into `isEODoneUD` + `isEODoneFB`** (`src/utils/roux.ts`): after an odd number of M moves, W/Y stickers on M-slice edges shift from U/D face positions to F/B positions. The old single check hardcoded U/D and missed these. The FB variant catches them; the exported `isEODone` returns `true` if either passes.
- **Relaxed `migrateSolveV1toV2` phase invariant**: only `label`, `group`, and `turns` are compared for structural match; timing differences (`recognitionMs`, `executionMs`) are logged as `console.info` instead of blocking migration. This allows real-data migration to proceed while still capturing timing deltas for observability.
- **Updated `ROUX_SOLVE_1` phases** to match new EO detection: EO turns 25→15, UL+UR turns 0→10. Previous stored phases reflected the buggy old `isEODone` that detected EO late.
- **Migrated `exampleSolves.ts` to v2**: all 3 example solves (CFOP mouse, CFOP cube, Roux cube) updated with `schemaVersion: 2`; Roux example has corrected move faces at 10 serials and fresh phase values.
- **Added `schemaVersion: 2`** to `CFOP_SOLVE_1` and `CFOP_SOLVE_2` fixtures — previously implicit v1.
- **`ROUX_SOLVE_1_V1` fixture** sourced directly from main branch: genuine pre-migration data with wrong M-adjacent face labels at 10 serials (136=U, 174=F, 175=F, 183=F, 186=U, 189=F, 192=U, 193=U, 198=D, 205=U).
- **Genuine v1→v2 migration test**: uses `ROUX_SOLVE_1_V1` to verify face corrections, `movesV1` preservation, and phase structure match against `ROUX_SOLVE_1`. Previous "full path" tests only exercised the graceful fallback.

**Key technical learnings:**

- `[insight]` **EO detection needs two cases after M moves.** After an odd number of M moves, the W/Y stickers that belong on M-slice edges appear on F/B faces (not U/D). A single `isEODoneUD` check hardcoded to U/D positions always returns false in this state. The fix splits into UD and FB variants — physically the same condition, just observed from opposite orientations.

- `[insight]` **Timing differences between v1 and v2 phases are expected and correct, not a sign of bugs.** For phases before EO (FB, SB, CMLL), timing is identical because the phase boundary falls at the same move index. For EO and UL+UR, timing differs because the corrected EO logic fires at a different move (index 15 vs 25) — a different cubeTimestamp → different recognitionMs/executionMs. The relaxed invariant lets migration succeed while logging the delta.

- `[gotcha]` **Sourcing a v1 fixture by reversing v2 corrections is fragile — use the main branch directly.** Reverse-engineering 10 face corrections manually risks errors. The main branch has the original recorded data; extracting it with `git show main:...` is authoritative and reproducible.

---

## v1.19.0 — M/E/S migration part 2 (2026-04-16 12:48)

**Review:** not yet

**Design docs:**
- M/E/S migration: [Spec](superpowers/specs/2026-04-15-phase3-m-move-design.md) [Plan](superpowers/plans/2026-04-16-m-migration-part-2.md)

**What was built:**
- **`migrateSolveV1toV2`** (`src/utils/migrateSolveV1toV2.ts`): corrects stored v1 face labels by simulating center positions from solved state. Fast path (no M/E/S moves): just bumps `schemaVersion` to 2. Full path: re-derives every geometric face label using the same center-tracking logic as `ColorMoveTranslator`, then verifies the corrected moves reproduce the stored phases exactly — graceful fallback if they don't.
- **`movesV1?: Move[]`** added to `SolveRecord`: holds the original pre-correction moves for Firestore-migrated records awaiting user review. Absent on localStorage and new records.
- **localStorage auto-migration** (`useSolveHistory`): on app load, all v1 solves are migrated silently. `movesV1` is stripped before saving — no review workflow for local solves.
- **Firestore migration** (`firestoreSolves.ts`): `migrateSolvesToV2InFirestore` migrates all v1 Firestore solves, writing `movesV1` for records that pass the full path so the user can review.
- **Debug panel button**: "Migrate solves to v2 (fix M/E/S labels)" in the cloud sync section — shows pending count, asks for confirmation, shows migrated/failed counts.
- **Sidebar review badge**: orange dot next to the solve number for any solve with `movesV1` present.
- **`SolveDetailModal` migration review section**: when `movesV1` is present, shows a table of only the moves whose face label changed (old in red, new in green) plus a "Mark as reviewed" button that deletes `movesV1` from Firestore.
- **`SolveDetailModal` unmigrated warning banner**: shown when `schemaVersion < 2` AND the solve has M/E/S moves — warns that phase analysis may be inaccurate and points to the debug panel.
- **Improved fallback logging**: `migrateSolveV1toV2` now logs exactly which phase field mismatched (and the actual vs expected values), or clearly states "corrected moves did not solve the cube" when `computePhases` returns null.

**Key technical learnings:**

- `[insight]` **The Roux fixture required a two-step fix**: the stored phases in `ROUX_SOLVE_1` were computed under the old M cycle (M ≈ L+R outer-face swaps, incorrect center movement). After correcting the move labels, `computePhases` with the correct M cycle produced different intermediate facelets → different phase boundaries → different `executionMs` timing. So the fixture needed both corrected moves AND freshly recomputed phases — not just corrected moves.

- `[gotcha]` **Fixture file corruption via Python script**: the script to replace `ROUX_SOLVE_1`'s moves array used a regex anchor that matched the wrong location in the file, corrupting `CFOP_SOLVE_1` instead. Fix: find the start/end by line number (searching for the const declaration and the top-level `}` after it), then replace by line range — surgical and unambiguous for large fixture files.

- `[insight]` **`migrateSolveV1toV2` is a one-way v1→v2 transform — not idempotent on v2 data.** The correction maps face labels through the original GAN color map: `FACE_TO_COLOR = { U:'W', F:'G', ... }`. On v1 data, 'F' means "turn whatever geometric face was F at record time" — which after M moves is wrong. On v2 data, 'F' means "turn the geometric F face (correct)". Re-running the correction on v2: it maps 'F' → green → finds green at 'D' (because after M CW, green center moves to D) → corrects to 'D' ≠ 'F'. The corrected moves then don't solve the cube → `computePhases` returns null → graceful fallback. This is correct behavior: the migration should only ever be applied to v1 records.

- `[gotcha]` **Generator test must run on the v1 fixture, not the v2 fixture.** The generator test (`generateRouxFixture.test.ts`) applies the correction and calls `computePhases` to produce the correct fixture. If it accidentally runs on the already-updated v2 fixture, it double-corrects the moves and `computePhases` returns null — the test fails. Always verify what `ROUX_SOLVE_WITH_M` points to before running the generator.

- `[note]` The phase invariant check in `migrateSolveV1toV2` compares `recognitionMs` and `executionMs` in addition to `turns`. This means migration can fail for v1 solves whose phases were computed with the old timing model even if the corrected moves do solve the cube. In practice, this was the failure mode for the original `ROUX_SOLVE_1`: turns matched (14 vs 14 for FB) but timing differed because the old M cycle produced different intermediate states.

**Process learnings:**

- `[insight]` **When a test fixture needs both data and derived values corrected, use a generator test**: write a short test that bypasses the phase invariant, applies the correction, recomputes phases fresh, and prints the result as JSON. This avoids manual phase calculation and is self-documenting.

---

## v1.18.0 — ColorMoveTranslator + correct M/E/S detection (2026-04-16 05:06)

**Review:** not yet

**Design docs:**
- Phase 3 M-move migration: [Spec](superpowers/specs/2026-04-15-phase3-m-move-design.md) [Plan](superpowers/plans/2026-04-16-phase3-implementation.md)

**What was built:**
- **`ColorMoveTranslator`** replaces `SliceMoveDetector`: wraps `GanCubeDriver`, translates GAN color-based face events (face index → color letter) to geometric face labels using center-position tracking. M/E/S detection via fast-window (100 ms) and retroactive (1500 ms) pairing logic, same as the old detector but now correct after M moves drift the centers.
- **Type-safe driver boundary**: `GanCubeDriver` now emits `ColorMove` (face = `FaceletColor`) via `ColorCubeDriver`; `ColorMoveTranslator` outputs `PositionMove` (face = `Face`) via `CubeDriver`. Downstream hooks are unchanged.
- **`syncFacelets` no-op guard**: prevents `syncFacelets` from clearing in-progress M detection when the facelets string hasn't actually changed — fixes a race where a React render between the R and L events of an M move would break detection.
- **`useTimer.replacePreviousMove` guard fix**: facelets now update during idle/scrambling (not just `solving`), so M moves in the scramble are tracked correctly before the solve starts. Timer previously failed to stop when M' was the first or last solving move.
- **`onResetCenters` moved to `useEffect`**: was called in the render body of `TimerScreen`, causing React's "cannot update while rendering" warning. Now fires in a `useEffect` on `armed` and `solved` state transitions.
- **Reorientation desync fix** (`useTimer.syncFacelets`): after `resetCenterPositions` reorients the virtual facelets to white-top, `useTimer`'s `faceletsRef` now receives the same reoriented state. Previously, `ColorMoveTranslator` and `useCubeState` got the reoriented frame but `useTimer` stayed in the old frame — physical face turns were mapped to wrong geometric labels and the timer would never stop for M-scramble solves.
- **`ScrambleTracker` handles `replacePreviousMove`**: scramble step tracking now correctly retracts and re-applies when an M move is detected retroactively.
- **Custom scramble input**: pencil button in `ScrambleDisplay` lets you type any scramble string directly.
- **`applyMoveToFacelets` extracted** to `src/utils/applyMove.ts` and shared across hooks/tests; now handles all 9 face moves + M/E/S + x/y/z rotations correctly (M cycles were wrong in the old inline version).
- **New docs**: `docs/cube-notation.md` — full reference for facelets format, face indices, M/E/S cycle positions, GAN BLE protocol, gyro FSM.

**Key technical learnings:**
- `[insight]` GAN hardware always reports face index based on color, not position — after an M move, what was face 0 (white/U) is now at D. A fixed `GAN_FACE_MAP` was always wrong; center tracking is the only correct approach.
- `[gotcha]` `syncFacelets` is called by `resetCenterPositions` on every `armed` transition. If it clears `_pending` unconditionally, it breaks M detection in a narrow race window (React re-render fires between the R and L BLE events of an M move). The no-op guard (`if facelets === _facelets return`) eliminates the race.
- `[gotcha]` `resetCenterPositions` reorients the virtual facelets to white-top (applying whole-cube rotation transforms). `ColorMoveTranslator` and `useCubeState` both receive the new frame, but `useTimer` maintained its own independent `faceletsRef` and was never told. Result: physical U turns (white top) were emitted as B moves (because blue moved to B in the reoriented frame), and facelets tracking in the timer diverged — timer never stopped on M-scramble solves. Fix: `useTimer` exposes `syncFacelets`, called with the reoriented string right after `resetCenterPositions`.
- `[insight]` `onResetCenters` must fire at `armed` (scramble complete), not at `solving` (first move). The first solve move may itself be an M — if `syncFacelets` fires between the R and L BLE events of that M, detection breaks even with the no-op guard. At `armed`, no solve moves are in-flight.

---

## v1.17.1 — Fix mouse driver in debug mode (2026-04-15 20:55)

**Review:** not yet

**What was built:**
- Fixed: debug mode `CubeCanvas` was missing `interactive` and `onMove` props — mouse driver moves were silently dropped. Added both, reusing the existing `handleCubeMove` callback already used in timer mode.

**Key technical learnings:**
- `[gotcha]` `CubeCanvas` in debug mode was instantiated by `App` directly while timer mode instantiates it inside `TimerScreen`. When the timer-mode canvas got `interactive` + `onMove`, the debug-mode one didn't — easy to miss since they're in different branches of the same file.

---

## v1.17.0 — Color-letter facelets + debug UX (2026-04-15)

**Review:** not yet

**Design docs:**
- M-move migration: [Plan](phase2-color-facelets.md)

**What was built:**
- **Phase 1 — non-breaking infrastructure:**
  - Added `RotationFace = 'x' | 'y' | 'z'` to `types/cube.ts`; `AnyFace` extended to include it
  - Added `FaceletColor = 'W' | 'R' | 'G' | 'Y' | 'O' | 'B'` type alias
  - Added `schemaVersion?: number` to `SolveRecord` (absent = v1, 2 = post-fix; groundwork for Phase 3 migration)
  - Fixed `isSolvedFacelets` to monochromatic center-match check — each face's stickers must match its center, replacing the fixed-string comparison
  - Added x/y/z whole-cube rotation cases to `applyMoveToFacelets` (not yet emitted by any driver)
- **Phase 2 — color-letter rename:**
  - `SOLVED_FACELETS` → `WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB`; U→W, F→G, D→Y, L→O throughout (R and B unchanged)
  - Updated `cfop.ts`, `roux.ts`, `CubeRenderer.ts` (FACE_COLORS keys), `FaceletDebug.tsx` (color lookup maps), and test fixtures
  - Facelets strings are never saved to disk; no impact on stored solve records
- **Bug fix:** debug move list (`MoveHistory`) never updated R→M on slice moves — `App.tsx` handled `'move'` but not `'replacePreviousMove'`; added the missing listener
- **Debug UX:**
  - Removed `SolveReplayer` from debug mode (no longer useful)
  - Moved "Clear recorded moves" button to directly below `MoveHistory`
  - `#debug` URL hash — opens debug mode on load; toggling the button syncs the hash; `hashchange` listener handles manual address-bar edits
- **Docs:** created `docs/url-routes.md` (all supported hash routes); created `docs/phase2-color-facelets.md` (migration plan with phase status)

**Key technical learnings:**
- `[insight]` GAN cube BLE events are color-based, not position-based — face index 0 always means "white center face" regardless of cube orientation. M moves in the old system were `L CCW + R CW` because centers could never shift; Phase 3 will fix this with center tracking.
- `[insight]` `isSolvedFacelets` as a fixed-string comparison breaks once centers can move (e.g. M2 L2 R2 returns to physically solved but not to `SOLVED_FACELETS`). Monochromatic check is the correct semantic for the new system.
- `[gotcha]` Adding `RotationFace` to `AnyFace` turns any `Record<AnyFace, ...>` map into a TypeScript error — must add x/y/z entries to `CubeRenderer`'s layer axis/value/angle maps even though they're never animated.
- `[gotcha]` `App.tsx` built the debug move list by listening for `'move'` only — `'replacePreviousMove'` (emitted when `SliceMoveDetector` pairs L+R into M) was ignored, so the interim R move was never replaced. A single extra `useCubeDriverEvent` call fixes it.
- `[note]` `window.location.hash = ''` adds a browser history entry and fires `hashchange`; `history.replaceState` does neither. Use `replaceState` when writing URL state that shouldn't be back-navigable or trigger other listeners.

---

## v1.16.0 — MAC address persistence + internal user analytics filter (2026-04-14)

**Review:** not yet

**What was built:**
- `GanCubeDriver`: saves cube's BLE MAC address to `localStorage` after first manual entry on macOS; reuses it on subsequent connections so the prompt never appears again
- `GanCubeDriver`: auto-clears saved MAC on connection failure (unless the user cancelled the BLE picker), so a bad MAC doesn't silently block future connections
- `analytics.ts`: tags the developer's account with `internal_user: 'true'` user property so their sessions can be filtered out in GA4 reports

**Key technical learnings:**
- `[insight]` macOS hides real BLE MAC addresses from Web Bluetooth apps — the GAN library falls back to prompting the user. Caching the entered value in localStorage makes this a one-time setup.
- `[gotcha]` Web Bluetooth user-cancellation throws `DOMException` with `name === 'NotFoundError'`. Must distinguish this from a failed connection (bad MAC) to avoid incorrectly clearing a valid saved MAC.
- `[note]` GA4 custom user properties must be registered under Admin → Custom definitions before they appear as filterable dimensions; 24–48 hour delay after registration.
- `[note]` Firebase UIDs are not secrets — safe to hardcode in source for internal-user tagging. Firestore security rules are what protect data.

---

## v1.15.0 — Driver filter for sidebar stats and Trends (2026-04-14 03:57)

**Review:** not yet

**Design docs:**
- Driver Filter: [Spec](superpowers/specs/2026-04-14-driver-filter-design.md) [Plan](superpowers/plans/2026-04-14-driver-filter.md)

**What was built:**
- **`DriverFilter` type and `SolveFilter` interface** — unified filter object `{ method: MethodFilter, driver: DriverFilter }` replacing the standalone `methodFilter` prop across the component tree
- **Driver dropdown** in sidebar stats section and TrendsModal header, next to the existing method dropdown — both labeled ("Method" / "Driver") to avoid ambiguity when showing "All"
- **`filterSolves` updated** — now filters by both method and driver; example solves bypass both filters; legacy solves without a `driver` field default to `'cube'`
- **localStorage persistence** — `sans_cube_method_filter` and `sans_cube_driver_filter` store both filter values across sessions (separate from `sans_cube_method` which controls the active recording method)
- **URL hash honors `method`/`driver` params** — navigating to `#trends?method=roux&driver=cube` overrides localStorage and opens Trends with those filters active

**Key technical learnings:**
- `[gotcha]` `sans_cube_method` already existed and stored the active *recording* method (which tags new solves). The filter state needed its own separate keys (`sans_cube_method_filter`, `sans_cube_driver_filter`) — conflating them would have silently broken method selection.
- `[insight]` When using a plain object (`SolveFilter`) as a React `useEffect` dependency, reference equality means it's safe only if the object comes from `useState` (stable reference between renders). Using primitive fields (`solveFilter.method`, `solveFilter.driver`) is more robust and makes the intent explicit.
- `[insight]` URL hash params written by a modal on mount will overwrite the incoming URL unless you apply the override to parent state *before* the modal renders. Fix: parse `method`/`driver` from the hash in `TimerScreen` and call `updateSolveFilter` alongside `setShowTrends(true)` — both batched into the same render.

---

## v1.14.0 — Trends chart animation tuning (2026-04-14)

**Review:** not yet

**What was built:**
- **`LINE_ANIMATION_DURATION_MS`** (default 200 ms) — replaces Recharts' default ~1500 ms draw-in animation on all `<Line>` components in both the total and phase charts.
- **`LINE_ANIMATION_EASING`** (default `"ease-out"`) — exposes the Recharts `animationEasing` prop as a tunable constant; fixes the "vertical drift" appearance caused by the default `"ease"` easing starting slow.
- **Phase chart fix** — phase chart `<Line>` components in the `.map()` were missing `animationDuration` entirely (still using the 1500 ms default); both props are now applied there too.
- Both constants live at `TrendsModal.tsx:28–31` with inline comments for tuning.

**Key technical learnings:**
- `[insight]` Recharts animates lines using SVG `stroke-dashoffset`. The animation has two tunable props: `animationDuration` (speed) and `animationEasing` (shape). The default `"ease"` easing starts slow, which reads visually as data points "drifting" vertically into position — `"ease-out"` eliminates this.
- `[gotcha]` When `<Line>` components are generated in a `.map()`, they're easy to miss when adding props to sibling static lines — always check both static and dynamic line renders.

---

## v1.13.0 — useSharedSolve extraction, shared link fixes, drag-to-zoom fix (2026-04-14 01:36)
**Review:** not yet

**What was built:**
- **`App.tsx` `useCubeDriverEvent` migration** — 4 remaining raw `useEffect` listeners in `App.tsx` converted to `useCubeDriverEvent`, completing the migration started in v1.12.
- **`useSharedSolve` hook** (`src/hooks/useSharedSolve.ts`): extracted 3 state fields (`sharedSolve`, `sharedSolveLoading`, `sharedSolveNotFound`) and both fetch effects (boot + hashchange) from `TimerScreen`. Returns `clearSharedSolve()` which clears state and resets the URL hash. Reduces `TimerScreen` from 10 to 7 `useState` declarations.
- **Fix: Firestore error no longer leaves spinner frozen** — `.catch(() => null)` added to `loadSharedSolve(shareId)` in the `Promise.race`. Previously, any Firestore rejection (network error, permissions, ad blocker in incognito) would reject the race silently, leaving `sharedSolveLoading = true` forever with no "not found" feedback.
- **Fix: invalid-format share IDs now show "not found" banner** — previously `#shared-notavalidid` (fails the 20-char regex) silently did nothing. Now `doLoad` calls `showNotFound()` immediately for bad-format IDs — no spinner, no Firestore fetch.
- **`showNotFound` helper** inside `useSharedSolve`: deduplicates the `setSharedSolveNotFound` + `history.replaceState` + `setTimeout` pattern used in three places.
- **Fix: drag-to-zoom completes when mouse releases outside the window** — `TrendsModal` now registers a `document`-level `mouseup` listener while a drag is in progress. Uses `refAreaRightRef` (synced on every mousemove) so the handler always reads the latest position regardless of closure capture timing.
- **Code quality backlog closed** — `playFrom` (#6) skipped (low ROI); TrendsModal refactor (#3) moved to Statistic section as a future-when-needed item.

**Key technical learnings:**
- `[gotcha]` `Promise.race` rejects if any contestant rejects — if you don't `.catch()` each promise individually, a Firestore error silently freezes loading state indefinitely. Always wrap race contestants with `.catch(() => fallback)`.
- `[insight]` Silent no-op for invalid input feels like a bug to users who landed on a `#shared-` URL — even a regex-rejected ID should give visible feedback ("not found"), just skip the spinner and the Firestore round-trip.
- `[insight]` For drag interactions, `onMouseUp` on the element never fires if the mouse leaves the window — register a `document`-level listener for the duration of the drag only, and use a ref (not state) to track the latest drag position so a stale closure can't produce wrong results.

---

## v1.12.0 — Code quality sweep + bug fixes (2026-04-14 01:13)
**Review:** not yet

**What was built:**
- **`useCubeDriverEvent` hook** (`src/hooks/useCubeDriverEvent.ts`): typed wrapper for `d.on(event, fn)` / `d.off(event, fn)` cleanup. Uses a handler ref internally so the handler is always the latest version without re-registering on every render — no `useCallback` required at call sites. Used by all 7 hooks/components that previously duplicated this pattern (`useTimer`, `useCubeState`, `useSolveRecorder`, `useScrambleTracker`, `useGestureDetector`, `App.tsx`, `TimerScreen.tsx`). Also exports `EventMap` from `CubeDriver.ts` to enable typed generic over event names.
- **`absorbPhaseIntoNext` helper** in `useTimer.ts`: extracted from two near-identical EOLL→COLL and CPLL→EPLL absorption blocks (~26 lines → 2 one-liner calls).
- **`CubieData` interface + `WeakMap`** in `CubeRenderer.ts`: replaced 7 `userData as { x, y, z }` unsafe casts with a typed `WeakMap<THREE.Mesh, CubieData>`. Also fixed `animateQuaternionTo` and `animateOrbitToDefaultView` — both started uncancellable RAF loops with no stored frame ID; concurrent calls would fight each other and `dispose()` couldn't cancel them.
- **Removed dead `partialDirection` field** from `TrackerState` in `useScrambleTracker.ts` — field was set in one place and never read.
- **Fix: method change no longer exits armed mode** — `setArmed(false)` removed from `MethodSelector.onChange` in `TimerScreen`. Method only affects phase analysis, not scramble completion.
- **Fix: facelets baseline preserved on method change while armed** — `resetTimer()` was unconditionally called on method change, resetting `faceletsRef` to `SOLVED_FACELETS` even though the cube was physically scrambled. Now gated: `if (!armed) resetTimer()`.
- **Fix: PhaseBar tooltip crash on stale `hoveredIndex`** — added `hoveredIndex < phaseRecords.length` guard before the tooltip IIFE. Pre-existing bug; method switching made it easier to hit by changing phase count between solves.
- **5 new tests** for `useCubeDriverEvent`: handler fires, cleanup on unmount, re-registration on `driverVersion` change, latest-handler-without-re-registering, null driver.

**Key technical learnings:**
- `[insight]` **The handler-ref trick eliminates `useCallback` requirements at call sites.** Store `handlerRef.current = handler` on every render, register a stable wrapper `(payload) => handlerRef.current(payload)` in the effect. The wrapper never changes identity so the effect never re-runs due to handler churn. This is strictly better than requiring `useCallback` at every call site.
- `[gotcha]` **`resetTimer()` resets the facelets baseline to `SOLVED_FACELETS`.** Safe when the cube is actually solved (pre-scramble), wrong when the cube is scrambled and the user is armed. Gating on `!armed` is the correct fix — the timer's tracking starts from `SOLVED_FACELETS` at first move anyway, so no reset is needed in the armed case.
- `[gotcha]` **`hoveredIndex` in `PhaseBar` is never automatically reset when `phaseRecords` shrinks.** React component state persists across re-renders regardless of prop changes. Any index into a prop array must be bounds-checked at the access point.
- `[insight]` **WeakMap is cleaner than `userData` for typed per-object metadata in Three.js.** `userData` is `Record<string, unknown>` — every read requires an unsafe cast. A `WeakMap<THREE.Mesh, CubieData>` populated at construction time gives typed access everywhere and lets the entries be GC'd with the mesh.

---

## v1.11.0 — Firebase Analytics (2026-04-14 00:25)
**Review:** not yet

**Design docs:**
- Analytics: [Spec](superpowers/specs/2026-04-13-analytics-design.md) [Plan](superpowers/plans/2026-04-13-analytics.md)

**What was built:**
- **Firebase Analytics initialized** in `src/services/firebase.ts` — exports `analytics` as `Analytics | null`, guarded by `VITE_FIREBASE_MEASUREMENT_ID` env var so it's a no-op in local dev without the key set.
- **`src/services/analytics.ts`** (new): typed wrappers for all events — `logSharedSolveViewed`, `logSolveShared`, `logSolveRecorded`, `logCubeConnected`, `logCubeFirstMove`, `logCloudSyncEnabled`, `setAnalyticsUser`. Every function guards `if (!analytics) return`.
- **`AnalyticsBanner`** (new): fixed bottom bar, one-time dismiss, stored in `localStorage` under `sans_cube_analytics_acknowledged`.
- **User identity**: `setAnalyticsUser(uid)` called in `useCloudSync` on auth state change — links events across devices for signed-in users.
- **Events wired**: `shared_solve_viewed` (boot effect), `solve_recorded` (solve complete), `solve_shared` (after share succeeds), `cube_connected` (BLE connect), `cube_first_move` (first move per page load with `driver: ble|mouse|touch`), `cloud_sync_enabled` (toggle on).
- **`cube_first_move` driver detection**: `driverType === 'cube'` → `'ble'`; else `window.matchMedia('(pointer: coarse)')` → `'touch'`; else `'mouse'`.
- **`tests/__mocks__/firebase-analytics.ts`** (new): vi.fn() stubs for `getAnalytics`, `logEvent`, `setUserId` — wired in `vite.config.ts` alias to fix 3 test suite failures.
- **`docs/analytics.md`** (new): event reference, consent banner docs, local dev and DebugView instructions.

**Key technical learnings:**
- `[gotcha]` **`getAnalytics(app)` throws at import time if the firebase stub app is not a real app instance.** Even with a null-guard on the env var, Vitest loads the real `firebase/analytics` module and its `getAnalytics` call crashes against the stub `{}` app. Fix: add `firebase/analytics` to the test alias map just like `firebase/app`, `firebase/auth`, and `firebase/firestore`.
- `[insight]` **`Analytics | null` export is the right pattern for optional Firebase services.** Guard at the service boundary (`firebase.ts`) and let every consumer be a no-op. Don't push the env-var check into every call site.
- `[note]` **Firebase Analytics is free with no usage limits.** The only Firebase costs are Firestore reads/writes (cloud sync and solve sharing). Analytics adds zero cost.
- `[note]` **DebugView shows events in real time; the Events page has a 24–48 hour delay.** Use DebugView or the Google Analytics Debugger Chrome extension for testing.

---

<!-- anchor below is a backward-compat alias: v1.10.0 was shared publicly as v1.10 before the semver migration -->
<a name="v110--solve-sharing-2026-04-13-2155"></a>

## v1.10.0 — Solve Sharing (2026-04-13 21:55)
**Review:** not yet

**Design docs:**
- Solve Sharing: [Spec](superpowers/specs/2026-04-13-solve-sharing-design.md) [Plan](superpowers/plans/2026-04-13-solve-sharing.md)

**What was built:**
- **`src/services/firestoreSharing.ts`** (new): `shareSolve`, `unshareSolve`, `updateSharedSolve`, `loadSharedSolve`, `newShareId`. Share IDs are 20-char base62 strings generated with `crypto.getRandomValues()`.
- **`SolveDetailModal` share UI**: Share button, shared URL display (read-only input + Copy button), Unshare button. Button is only shown when cloud sync is enabled. `readOnly` prop hides all action controls for viewer mode (method selector, delete, share, copy-as-example).
- **`useSolveHistory.updateSolve`**: fire-and-forget `updateSharedSolve` call when the updated solve has a `shareId` set — keeps the public copy in sync on method changes.
- **`#shared-{shareId}` hash routing in `TimerScreen`**: on boot and on `hashchange`, fetches the public solve and opens `SolveDetailModal` in read-only mode. 3-second timeout; "Solve not found or no longer shared" banner on failure. Loading overlay shown while fetch is in flight.
- **Firestore data model**: `public_solves/{shareId}` (publicly readable by ID, not listable), `users/{uid}/shared_solves/{shareId}` (empty ownership registry — `exists()` check in rules avoids storing `ownerUid` in the public doc).

**Key technical learnings:**
- `[gotcha]` **`useEffect` ordering causes URL-hash clearing before async state applies.** Effects run synchronously in definition order on mount. A URL-update effect that clears the hash fires with `sharedSolveLoading = false` even though the boot effect's `setSharedSolveLoading(true)` call is batched and hasn't taken effect yet. Fix: explicitly restore the `#shared-{shareId}` hash after the fetch resolves, rather than relying on the guard alone.
- `[gotcha]` **`request.resource.size` is not a valid Firestore rules property.** It evaluates to `null`, making `null < 200000` always `false` — silently denying all writes. Firestore enforces a 1 MB document limit at the storage layer; no explicit size check is needed in rules.
- `[insight]` **Write ordering matters for `exists()` checks in security rules.** The registry doc (`users/{uid}/shared_solves/{shareId}`) must be written before the public doc (`public_solves/{shareId}`) — the `create` rule's `exists()` check reads the registry server-side. Unshare reverses the order: delete public doc first (while registry still exists for the `delete` rule), then delete registry.
- `[gotcha]` **Wildcard user rule must cover `meta/counter`.** Explicit per-collection rules (`/users/{uid}/solves/{id}`, `/users/{uid}/shared_solves/{id}`) miss the counter doc at `users/{uid}/meta/counter`. The wildcard `match /users/{userId}/{collection}/{docId}` covers all two-segment paths under any user, including `meta/counter`.
- `[insight]` **`crypto.getRandomValues()` not `Math.random()` for capability URLs.** Share IDs are unguessable tokens — their security depends on entropy. `Math.random()` is not cryptographically secure. `crypto.getRandomValues()` gives the same API surface with proper randomness.

---

## v1.9.0 — Detect Method Mismatches Debug Tool (2026-04-13 21:17)
**Review:** not yet

**What was built:**
- **`detectMethod.ts`** (`src/utils/detectMethod.ts`): pure utility that scans a list of `SolveRecord`s and returns any where the stored `method` field likely doesn't match how the cube was actually solved. Uses two heuristics: M-move count (≥ 8 confidently identifies Roux, since Roux LSE is exclusively M+U) and first-phase turn count under each method (recompute via `recomputePhases` — the wrong method produces a bloated first phase). Returns `null` (ambiguous, don't flag) if both methods produce plausible first phases.
- **Debug mode: "Detect method mismatches" button (local)**: scans `localStorage` solves and shows results in an inline panel. Each flagged solve displays solve ID, stored method, suggested method, M-move count, and first-phase turns under both CFOP and Roux.
- **Debug mode: "Detect method mismatches" button (cloud)**: loads all solves from Firestore first, then runs the same heuristic. Separate button in the Firebase panel, disabled while scanning.
- **Fix flow reuses `SolveDetailModal`**: clicking a flagged solve opens it in `SolveDetailModal` with full `onUpdate`/`onDelete` wiring. After a method change, the mismatch panel re-runs `detectMethodMismatches` on just that solve — removes it from the list if fixed, updates in place if still flagged.

**Key technical learnings:**
- `[insight]` **M-move count is the strongest signal for BLE Roux solves.** Roux LSE uses only M and U moves — a typical solve has 10–20 M moves. CFOP almost never exceeds 4 M moves. Threshold ≥ 8 avoids false positives.
- `[insight]` **Recomputing under the wrong method bloats the first phase.** CFOP Cross turns and Roux FB turns each have a natural ceiling (~15 and ~18 respectively). If a solve exceeds the ceiling under method A but not method B, it's a strong signal the solve was done with method B.
- `[insight]` **Don't flag ambiguous cases.** If both methods produce a plausible first phase, `suggestMethod` returns `null` — the solve is skipped. False positives are more damaging than false negatives for a correction tool.
- `[note]` **Reusing `SolveDetailModal` for the fix flow avoids building new UI.** The modal already has `MethodSelector`, `onUpdate`, and `onDelete` — connecting it to the debug panel's `selectedDebugSolve` state was enough to make the full fix flow work.

---

## v1.8.0 — Method Update in SolveDetailModal (2026-04-13 19:05)
**Review:** not yet

**Design docs:**
- Method Update: [Spec](superpowers/specs/2026-04-13-method-update-design.md) [Plan](superpowers/plans/2026-04-13-method-update.md)

**What was built:**
- **Method selector in SolveDetailModal**: `MethodSelector` added to the "Detailed Analysis" header — lets the user switch a stored solve between CFOP and Roux (and any future method) without leaving the modal.
- **`recomputePhases` utility** (`src/utils/recomputePhases.ts`): pure function that replays `solve.moves` against facelets, detects phase transitions via `phase.isComplete(facelets)`, computes `recognitionMs`/`executionMs` from `cubeTimestamp` diffs, and applies CFOP merge rules (EOLL/COLL, CPLL/EPLL) matched by label — no-op for non-CFOP methods. Returns `null` if the cube is not solved after all moves.
- **`updateSolve` in `useSolveHistory`**: replaces a solve by `id` in localStorage, or calls `updateSolveInFirestore` (idempotent `setDoc`) in cloud mode.
- **Optimistic update with rollback**: `SolveDetailModal` updates `localSolve` immediately for instant UI feedback, disables the MethodSelector and Delete button while saving, and rolls back on error using a `previousSolve` capture before the optimistic update.
- **Inline error message**: `recomputePhases` returning `null` (corrupt/incomplete solve) shows a 4-second inline error — no toast component exists yet.
- **Round-trip tests** (`tests/utils/recomputePhases.test.ts`): data-provider style with `it.each` over `CFOP_SOLVES` and `ROUX_SOLVES` arrays. Verifies CFOP→Roux→CFOP and Roux→CFOP→Roux produce exactly identical `turns`, `recognitionMs`, and `executionMs`.
- **`tests/fixtures/solveFixtures.ts`**: real solve records copied from `exampleSolves.ts` with quaternion fields stripped. `CFOP_SOLVES` (2 solves) and `ROUX_SOLVES` (1 solve) — append to these arrays to expand test coverage.

**Key technical learnings:**
- `[gotcha]` **Stale closure in rollback.** Writing `setLocalSolve(localSolve)` in a `catch` block captures `localSolve` from the closure at function-definition time — it may already reflect the optimistic update. The fix: `const previousSolve = localSolve` before any state mutation, then `setLocalSolve(previousSolve)` in `catch`.
- `[insight]` **Round-trip timing is exact, not approximate.** `recomputePhases` reads raw `cubeTimestamp` integers from `solve.moves` — those never change. The same moves, replayed against the same cube states, hit the same phase boundaries every time. `toBe` (strict equality) is correct, not `toBeCloseTo`.
- `[note]` **`phase.isComplete(facelets)` is called after each move, not before.** The while-loop pattern used in `useTimer` advances through phases as each move lands — including multiple phase completions on a single move (e.g. OLL skip completes cross+F2L+OLL simultaneously).
- `[insight]` **CFOP merge rules are label-matched, making them a safe no-op for other methods.** Checking `phases[i].label === 'EOLL'` means the same merge logic can run unconditionally after any method recompute — if the labels aren't present, nothing happens.

---

## v1.7.0 — URL Deep Link Fixes + Cloud Sync Loading Overlay (2026-04-09 23:24)
**Review:** not yet

**Design docs:**
- URL Routing: [Spec](superpowers/specs/2026-04-06-url-autoplay-design.md)

**What was built:**
- **URL deep link fix (cloud sync)**: visiting `#solve-N` or `#trends?...` while cloud sync is loading now correctly opens the modal after solves load. Root cause: the hash-write effect (`selectedSolve` → URL) ran on initial mount and called `history.replaceState` to clear the hash — before the resolve effect could read it. Fix: gate the hash-write effect on `urlResolvedRef.current` so it does nothing until after the initial URL has been resolved.
- **hashchange listener**: after initial load, user-typed URL changes (address bar, browser back/forward) now navigate the app. Typing `#solve-N` opens that solve; `#trends?...` opens TrendsModal; empty hash closes both. Uses `window.addEventListener('hashchange', ...)` re-registered whenever `solves` changes to keep a fresh reference.
- **`window.location.hash =` → `history.replaceState`**: the hash-write effect was using `window.location.hash = ...` which fires a `hashchange` event — would have looped back into the new listener. Switched to `history.replaceState` (silent URL update).
- **Cloud sync loading overlay**: when arriving at `#solve-N` or `#trends?...` with cloud sync enabled, a semi-transparent overlay blocks interaction and shows "Syncing solve from cloud…" / "Syncing trends from cloud…" until the data is ready. Implemented by capturing the initial hash in `initialHashRef` at mount and showing the overlay while `cloudLoading` is true.
- **Code deduplication**: extracted `filterSolves` to `useSolveHistory.ts` (was duplicated in `SolveHistorySidebar.tsx` and `TrendsModal.tsx`); exported `StatEntry` and `SolveStats` interfaces from `useSolveHistory.ts` (were redefined in `SolveHistorySidebar.tsx`).
- **Manual test checklist expanded**: added sections for Connection, Core Timer Flow, Solve History Sidebar, Solve Detail Modal, Cloud Sync, and Debug Mode — previously the checklist only covered Scramble Tracker and Trends.

**Key technical learnings:**
- `[note]` **`useEffect` runs on initial mount unconditionally.** A hash-write effect with no guard will fire on first render — even before any async data loads. If that effect clears the URL when state is empty, it wipes the hash that a later effect was meant to read. Always gate side effects that touch the URL on a "resolved" flag.
- `[gotcha]` **`window.location.hash =` fires `hashchange`; `history.replaceState` does not.** When adding a `hashchange` listener, any code that writes the hash via `window.location.hash =` will trigger its own listener. Use `history.replaceState` for programmatic URL updates to avoid the loop.
- `[insight]` **Capturing initial hash in a ref at mount is the safest pattern.** `window.location.hash` read inside a `useEffect` may be stale if another effect already cleared it. A ref initialized with `useRef(window.location.hash)` captures the value synchronously before any effects run.
- `[insight]` **A single `hashchange` listener replaces repeated "resolve on load" logic.** Rather than multiple effects each trying to read the URL at different lifecycle moments, one listener handles all post-load navigation uniformly.

---

## v1.6.0 — Hardware Clock Timing Fix + Solve List Copy (2026-04-09 22:40)
**Review:** not yet

**What was built:**
- **Hardware clock timing fix** (`useTimer`): all solve and phase timing now uses `cubeTimestamp + hwOffset` instead of `Date.now()`. Eliminates ~1s inflation on Roux solves where the final M/M' arrives late via the `SliceMoveDetector` retro BLE path. Both normal and `replacePreviousMove` paths fixed.
- **Per-solve hwOffset calibration**: `hwOffset = Date.now() - move.cubeTimestamp` computed on the first move of each solve — self-contained, resets drift each solve, no hardware clock query needed at connect time.
- **Retroactive recalibration**: `recalibrateSolveTimes()` utility recomputes `timeMs` from stored `moves[].cubeTimestamp` spans. Available as debug mode buttons for both localStorage and Firestore solves.
- **Example solve timeMs corrected**: id=-2 (−217ms), id=-3 (−340ms).
- **Copy solve list button**: "copy" button next to "Last Solves" copies #, Time, TPS, Method as TSV — paste-ready for spreadsheets or notes. Disabled while cloud solves are loading.
- **Sidebar scroll fix**: page no longer scrolls vertically; solve list scrolls internally with a sticky `# Time TPS Method` header. Fixed by proper flex height chain: `height: 100vh` + `overflow: hidden` at App root → `flex: 1 / minHeight: 0` at TimerScreen → `height: 100%` at sidebar wrapper → `flex: 1 / overflow-y: auto / minHeight: 0` at scroll container.
- `docs/debug-mode.md` added to document all debug mode tools and buttons.

**Key technical learnings:**
- `[insight]` **BLE delivery time ≠ move timestamp.** `cubeTimestamp` records when the physical move happened on the hardware clock. BLE can deliver the event 1+ second later. `Date.now()` at arrival inflates solve times — always prefer `cubeTimestamp + hwOffset`.
- `[gotcha]` **`minHeight: 0` is required on flex scroll containers.** Flex items default to `min-height: auto`, which prevents overflow from engaging. Without it, `overflow-y: auto` does nothing — the child just grows past the viewport.
- `[note]` **`height: 100vh` on a sidebar that starts below the top of the page causes overflow.** The sidebar was below `ConnectionBar`, so `100vh` overflowed by ConnectionBar's height. The fix is `height: 100%` — fill the flex parent, not the full viewport.
- `[note]` **Sticky `<thead>` works inside `overflow-y: auto` in Chromium.** `position: sticky; top: 0` on `<thead>` within a scrolling `<div>` works correctly — no wrapper gymnastics needed.

---

## v1.5.1 — Stats Trends Enhancements & Polish (2026-04-09 14:01)
**Review:** not yet

**Design docs:**
- Stats Trends: [Spec](superpowers/specs/2026-04-09-stats-trends-design.md) [Plan](superpowers/plans/2026-04-09-stats-trends.md)

**What was built:**
- **Total tab multi-toggle**: Total / Exec / Recog independently toggleable; ao5/ao12 per type; both tabs default to Total only
- **Phase hiding**: click legend label to show/hide individual phase lines
- **Split color variants**: sub-phases within a group get HSL lightness variants derived from the base phase color
- **Range zoom**: drag to select range, committed to a `zoomStack`; ← Back (one level) and Reset zoom (clear all); both visible whenever `zoomStack.length >= 1`; drag threshold of ≥2 seq units to avoid trackpad false positives
- **Out-of-range fix**: pre-filter `visibleTotalData`/`visiblePhaseData` to current domain — Recharts `domain` prop only scales the axis, it does not remove data points
- **X-axis domain padding**: `[firstVisSeq - 0.5, lastVisSeq + 0.5]` prevents blank left section on small zoomed ranges
- **Day reference lines**: day-boundary `ReferenceLine` at start of each day (browser timezone); `#4a6080` color, `6 3` dash; labels show `M/D`; top margin increased to 24 to prevent label clip
- **Datetime in tooltips**: both Total and Phase tooltips show `YYYY/MM/DD HH:MM:SS` (browser timezone)
- **Click-to-detail fix**: clicking near a hovered dot opens SolveDetailModal; root cause — Recharts `onMouseMove` at chart level never populates `activePayload`, only the custom `Tooltip` component receives it via internal context; fix: update `hoveredSolveIdRef` inside the tooltip render function; tooltip shows actual `solve.seq` via `solveMap`, not windowed index
- **Disable while cloud loading**: Trends button and method filter select both disabled when `cloudLoading` is true; non-cloud users unaffected (`cloudLoading` undefined)
- **Esc chain**: TrendsModal closes on Esc only when SolveDetailModal is not open (`detailOpen` prop); full chain: detail → trends → timer
- **Semi-transparent background**: `rgba(10,10,26,0.88)` with `backdropFilter: blur(2px)` so the cube shows through
- **Phases tab multi-toggle**: Total / Exec / Recog independently toggleable; Total=solid, Exec=`5 3` dash, Recog=`2 3` dash; phase colors preserved
- **Default window**: both tabs default to All (mobile still 25)

**Key technical learnings:**
- `[gotcha]` **Recharts `onMouseMove` at chart level does not provide `activePayload`.** The chart-level event shows `activeLabel` and `activeCoordinate` but `activePayload` is always undefined. The `Tooltip` component receives the correct payload via internal context. Fix: update `hoveredSolveIdRef` inside the custom tooltip render function (where `payload` is always available), rather than in `onMouseMove`.
- `[gotcha]` **Recharts `onClick` also never has `activePayload`.** The ref approach captures the solveId during tooltip render; the click handler reads from the ref.
- `[insight]` **`didZoomRef` vs. state for drag/click disambiguation.** Using a state variable to track "a zoom just happened" causes a re-render between mouseUp and click, resetting the flag before the click handler reads it. A ref holds the value across the event sequence without triggering re-renders.
- `[insight]` **Multiple `window.addEventListener('keydown')` handlers all fire simultaneously.** `stopPropagation` on a `window` listener does not prevent other `window` listeners from firing. Fix: pass `detailOpen` prop to TrendsModal and guard its Esc handler with `!detailOpen`.
- `[gotcha]` **Windowed index ≠ solve sequence number.** `buildTotalData` / `buildPhaseData` assigns `seq: i + 1` as the x-axis position within the current window — not the real solve number. Always use `solveMap.get(solveId).seq` for display.
- `[insight]` **Refs across event sequences don't need state.** `didZoomRef` and `hoveredSolveIdRef` both needed to survive from one event (mousedown/mousemove) to a later one (click) without triggering re-renders in between. Refs are the right tool — state would reset the value by re-rendering before the click handler reads it.
- `[note]` Zoom UX required careful state design: zoom stack (not a simple on/off), pre-filtered data (not just axis domain), and drag threshold (not just any movement)

**Process learnings:**
- `[insight]` **Add console.log before trying another fix.** The click-to-detail bug went through three fix attempts before we added logging. The log immediately revealed `hasPayload: false` in `onClick` and `activePayload: undefined` in `onMouseMove` — two distinct root causes that no amount of guessing would have found. Systematic debugging (Phase 1 evidence gathering) would have saved two cycles.
- `[gotcha]` **When a Recharts event handler "should" have data but doesn't, suspect internal context.** Recharts distributes chart state through React context, not through every callback. `Tooltip` is a privileged consumer; chart-level handlers are not. Check the Recharts source or add logging before assuming an event should carry payload.

---

## v1.5.0 — Stats Trends Initial Implementation (2026-04-09 05:18)
**Review:** not yet

**Design docs:**
- Stats Trends: [Spec](superpowers/specs/2026-04-09-stats-trends-design.md) [Plan](superpowers/plans/2026-04-09-stats-trends.md)

**What was built:**
- `src/utils/trends.ts` — pure `buildTotalData` / `buildPhaseData` functions with trimmed rolling Ao5/Ao12; fully unit-tested (21 tests, TDD)
- `src/components/TrendsModal.tsx` — full-screen fixed overlay with Total tab (scatter dots + Ao5/Ao12 lines) and Phases tab (one line per phase/group); Exec/Recog time type toggle; Group/Split toggle; window size selector (25/50/100/All); URL hash sync
- `src/components/TimerScreen.tsx` — lifted `methodFilter` state; added `showTrends`; fixed URL cloud timing bug (deferred hash resolution until cloud data loads)
- `src/components/SolveHistorySidebar.tsx` — added "Trends" button to stats header; `methodFilter` now a controlled prop from `TimerScreen`

**Key technical learnings:**

- `[gotcha]` **`<Scatter>` inside `<ComposedChart>` does not reliably use the chart's top-level `data` prop.** Using `dataKey="value"` alone produces invisible dots. Either pass `data={...}` directly to `<Scatter>`, or use a `<Line stroke="none" dot={...}>` — the Line approach is simpler and definitely works.

- `[insight]` **zIndex layering for stacked overlays needs a clear hierarchy.** When SolveDetailModal (zIndex 100) needed to appear on top of TrendsModal (zIndex 200), it rendered behind. Fixed by bumping SolveDetailModal to zIndex 300. Rule: establish the overlay z-stack explicitly when adding a new overlay.

- `[gotcha]` **State lifting + controlled props breaks tests that use interaction events.** Lifting `methodFilter` from local state to a prop means `userEvent.selectOptions` no longer causes re-renders (the mock `setMethodFilter` doesn't update state). Fix: a `SidebarWrapper` test helper that holds real state — keeps tests testing real behavior without coupling to the parent.

- `[gotcha]` **`phaseKeys` should union all data points, not just the first.** If the first solve in the window has incomplete phases, later phase keys are missing from the chart. Use `Array.from(phaseData.reduce((set, pt) => { Object.keys(pt).forEach(...) }, new Set()))`.

**Process learnings:**
- `[note]` Subagent-driven development with 7 tasks + two-stage review per task produced clean, well-reviewed code at each step
- `[note]` The plan self-review step (spec coverage + placeholder scan + type consistency check) caught the test wrapper gap before execution

---

## v1.5.0-design — Stats Trends Design Session (2026-04-09 01:59)
**Review:** complete

**Design docs:**
- Stats Trends: [Spec](superpowers/specs/2026-04-09-stats-trends-design.md)

**What was designed:**
- Full spec for the stats trends feature — [2026-04-09-stats-trends-design.md](superpowers/specs/2026-04-09-stats-trends-design.md)
- Dedicated full-screen modal opened from a "Trends" button in the sidebar
- Two tabs: Total (scatter + Ao5/Ao12) and Phases (per-group lines)
- Time type toggle (Exec / Recog) on both tabs
- Group toggle (Grouped / Split) — groups derived from `Phase.group` field, not hardcoded
- Window toggle: 25 / 50 / 100 / All (mobile defaults to 25)
- Method filter shared/synced between sidebar and modal (lifted to TimerScreen)
- Click a chart dot → opens SolveDetailModal on top; close returns to chart
- URL encoding: `#trends?method=...&tab=...&window=...&group=...&timetype=...`

**Bug discovered — existing `#solve-<id>` URL with cloud sync:**
`selectedSolve` is initialized via a `useState` lazy initializer that calls `solves.find(id)`. When cloud sync is on, `solves` is empty at mount — Firestore hasn't returned yet. Fix: replace lazy initializer with a `useEffect` gated on `isCloudLoading`, using a `urlResolvedRef` to ensure it only fires once.

**Learnings:**
- `[note]` Recognition time (`recognitionMs`) and execution time (`executionMs`) per phase are already recorded — the trends feature doesn't need new data, just new visualization
- `[note]` Phase grouping is already encoded in the `Phase.group` field — derive from that, don't hardcode method-specific logic
- `[insight]` URL-triggered state needs to be deferred until cloud data is ready — lazy `useState` initializers run before Firestore returns

---

## Meta — Using Claude More Effectively (2026-04-08 13:30)
**Review:** not yet

### /clear reloads CLAUDE.md

`/clear` resets the conversation context but not the system prompt. CLAUDE.md is reloaded fresh at the start of every new session, including after `/clear`. This means:

- You can `/clear` freely to reclaim context window without losing any conventions or reminders
- Any instruction in CLAUDE.md is always present — you never need to repeat yourself after a clear
- Auth state, solve history, and other runtime state are unaffected by `/clear` — it only clears Claude's conversation memory

### Keep the docs list in CLAUDE.md current

CLAUDE.md has a `docs/` index. Keeping it up to date pays off because Claude reads it at session start and knows exactly which doc to open for a given topic — instead of globbing `docs/` and reading files blindly. One line added to CLAUDE.md when creating a doc saves context on every future session that touches that area.

The instruction added to CLAUDE.md: *"When creating any new `docs/*.md` file, always add it to this list with a one-line description."* This means Claude self-maintains the index going forward.

### Context window cost of CLAUDE.md entries

Adding a short instruction or doc reference to CLAUDE.md has negligible context cost. The benefit (Claude behaving correctly without prompting) always outweighs the cost of the few tokens it takes up.

---

## Meta — Using CLAUDE.md as a Process Brain (2026-04-08 13:33)
**Review:** not yet

The biggest workflow shift this session wasn't a feature — it was realising that CLAUDE.md can act as a persistent process brain that removes the need to remember conventions, reminders, and decisions across sessions.

### The problem it solves

Claude Code starts every session cold. Without CLAUDE.md, you repeat yourself:
- "remember we use Vitest not Jest"
- "don't forget to update the devlog"
- "the cube orientation is green front / yellow bottom"

With CLAUDE.md, you write it once and never say it again.

### What we put in CLAUDE.md and why

| Entry | Why it's there |
|-------|---------------|
| Who is working on this (speedcuber, GAN 12, new to web dev) | Claude adapts explanations to your level — no over-explaining BLE, no under-explaining React |
| Tech stack + Web Bluetooth caveat | Prevents Claude from suggesting Firefox-incompatible solutions |
| Key architecture (drivers, hooks, components, services) | Claude knows where to look before reading code |
| Persistence section | Prevents Claude from suggesting localStorage when Firestore is active, or vice versa |
| Doc index (`docs/`) | Claude reads only relevant docs — saves context window |
| Current State + version | Claude knows what's done and what's in progress |
| GitHub Upload Safety | A checklist Claude runs before any commit or push — secrets never slip through |
| End of Session reminder | Claude prompts you to update the devlog — you don't have to remember |

### The principle: delegate memory, not just code

Claude can hold your preferences, conventions, and reminders as reliably as code — more reliably than your own memory across sessions. Anything you've said more than once to Claude is a candidate for CLAUDE.md.

Good candidates:
- Project conventions that aren't obvious from the code
- Reminders that should happen at a specific moment ("at end of session...")
- Context that would take Claude several file reads to infer (cube orientation, who you are, what browser matters)
- Decisions already made that shouldn't be revisited ("we use Firestore, not Supabase")

Bad candidates (don't put these in CLAUDE.md):
- Things derivable from reading the code
- Temporary state or in-progress work (use tasks for that)
- Long documents (link to `docs/` instead)

### The workflow that emerged

1. **Brainstorm in conversation** — explore options, ask questions, decide together
2. **Write a plan** — locked-in spec, exact file paths, complete code, no placeholders
3. **Execute with subagents** — fresh context per task, two-stage review (spec then quality)
4. **Merge + tag** — clean history, tagged versions
5. **Update devlog** — capture learnings while fresh (CLAUDE.md reminds you)
6. **Update CLAUDE.md** — if a new convention emerged, add it so future sessions inherit it

The key insight: CLAUDE.md is not documentation for humans — it's instructions for Claude. Write it in imperative, from the project's perspective, as if briefing a contractor who just walked in.

---

## v1.4.0 — Method Filter in Solve History Sidebar (2026-04-08 23:05)
**Review:** not yet

**Design docs:**
- Method Filter: [Spec](superpowers/specs/2026-04-08-method-filter-design.md) [Plan](superpowers/plans/2026-04-08-method-filter.md)

**What was built:**
- Method filter dropdown (All / CFOP / Roux) in `SolveHistorySidebar`, present in both desktop sidebar and mobile overlay modes
- Stats derived locally inside the sidebar from the filtered solve pool — no longer passed as a prop from `TimerScreen`
- `useSolveHistory` no longer computes or returns `stats`; `computeStats` remains exported for direct use

**Design decisions:**
- Filter state is local `useState` inside the sidebar — no need to lift it up since nothing else consumes it
- Example solves always show regardless of filter (they're included for any method setting)
- Legacy solves with no `method` field default to `'cfop'` — consistent with the existing convention in `SolveRecord`
- Stats pool excludes examples (same as before — examples don't count toward averages)

**Learnings — TDD workflow:**
- `[note]` Writing the failing tests first (Task 1 committed before implementation) made the acceptance criteria explicit and caught the exact props contract mismatch immediately
- `[note]` The three-commit structure (failing tests → implementation → stats cleanup) produced a clean, reviewable history
- `[note]` Plan-driven execution with worktrees made the session fast: no ambiguity mid-task, isolated branch, clean merge

**Learnings — component design:**
- `[insight]` Moving stat derivation into the component that owns the filter (rather than the parent) is the right call when the parent has no use for filtered stats — prop drilling a computed value just to filter it downstream is a smell
- `[note]` Extracting `StatsSection` as an inner component kept both render paths (sidebar + overlay) DRY without over-engineering

---

## v1.3.1 — Cloud Loading UX (2026-04-08 15:10)
**Review:** not yet

**What was built:**
- Loading spinner in the solve history sidebar when cloud sync is enabled and data hasn't arrived yet
- Suppresses example solves and local solves during the loading window to prevent false content flashing

**The core bug — React render cycle gap:**

When Firebase `onAuthStateChanged` resolves, it calls `setUser(user)` and `setAuthLoading(false)`. React batches these into one render. But `useEffect` runs *after* render — so there's exactly one render where:
- auth is resolved (`authLoading = false`, `user = User`)
- the Firestore loading effect hasn't started yet (`cloudLoading` is still `false`)

Any loading state that relies on an effect to turn `true` has this one-render blind spot, which appears as a brief flash of local content.

**The fix — derive loading from `cloudReady`, not `cloudLoading`:**

Instead of a `cloudLoading` state that an effect switches on, track `cloudReady` (has Firestore ever successfully returned for this uid?). Derive the loading condition purely:

```ts
const isCloudLoading = enabled && (!user || !cloudReady)
```

This stays `true` continuously from page load through auth resolution through Firestore return — no effect cycle needed to turn it on, so no gap.

**Rule of thumb:** if a loading state needs an effect to *start* it, there's a window between "condition became true" and "effect ran" where it's incorrectly false. Prefer deriving loading from "has the data arrived yet?" rather than "have I started fetching?"

---

## v1.3.0 — Firebase Cloud Sync (2026-04-08 13:29)
**Review:** not yet

**Design docs:**
- Firebase Cloud Sync: [Plan](superpowers/plans/2026-04-08-firebase-cloud-sync.md)

**What was built:**
- Opt-in cloud sync via Firebase Firestore, toggled from the debug section
- Google Sign-In with per-user data isolation
- One-time migration of localStorage solves to Firestore on first enable
- GitHub Actions deploy workflow for GitHub Pages

**Learnings — Firebase:**
- `[note]` Firebase web API keys are not secrets — security comes from Firestore rules, not the key
- `[note]` `authDomain` should always be the Firebase-provided domain (`*.firebaseapp.com`), not your hosted domain
- `[note]` Firebase Auth automatically whitelists `localhost` — no config needed for local dev
- `[gotcha]` Firestore rejects `undefined` values (only accepts `null`) — always sanitize objects before writing with `JSON.parse(JSON.stringify(obj))`
- `[gotcha]` `npm ci` in CI fails when `package-lock.json` was generated on macOS (Linux-specific optional native packages like `@emnapi/*` are missing) — use `npm install` instead in the workflow

**Learnings — debugging:**
- `[note]` When a Firebase popup closes immediately, check the browser console — `CONFIGURATION_NOT_FOUND` means Google sign-in provider isn't enabled in the Firebase Console (Authentication → Sign-in method → Google → Enable)
- `[gotcha]` Firestore rejects `undefined` values silently at runtime, not at compile time — TypeScript optional fields (`field?`) become `undefined`, which Firestore refuses. Fix: `JSON.parse(JSON.stringify(obj))` strips them before writing
- `[gotcha]` `npm ci` fails in CI when `package-lock.json` was generated on macOS — Linux CI adds platform-specific optional packages (`@emnapi/*`) not in the Mac-generated lock file. Fix: use `npm install` in the workflow instead

**Learnings — Firebase concepts:**
- `[note]` Firebase Auth authorized domains control which domains can trigger the OAuth popup — `localhost` is whitelisted by default, but `sansword.github.io` must be added manually for GitHub Pages
- `[note]` `authDomain` in the config should always be the Firebase-provided domain (`*.firebaseapp.com`), not the hosting domain — it's used internally for the OAuth flow, not to identify where the app lives
- `[note]` Firebase web API keys are not secrets — they're safe to expose in the browser bundle; security is enforced by Firestore rules and Auth, not the key itself
- `[note]` Firestore document sort order is determined at query time (`orderBy('date', 'asc')`) — there's no default ordering
- `[note]` UID is assigned permanently by Firebase when a user first signs in with Google — same account always gets the same UID across all devices, no management needed

**Learnings — Claude Code workflow:**
- `[note]` Subagent-driven development (brainstorm → write plan → execute with subagents + two-stage review) produced high-quality, reviewed code with no surprises
- `[note]` Subagents sometimes do more than asked (adding Firebase test stubs) when they hit a blocker — this is correct behavior, not scope creep; review the extra work before accepting
- `[note]` Discussing architecture decisions in conversation before writing the plan catches design issues cheaply (e.g. single-user vs multi-user, localStorage default vs cloud default, Firebase-only vs dual-write)
- `[note]` CLAUDE.md doc index is better than loading docs eagerly — listing docs with one-line descriptions lets Claude read only what's relevant per session
- `[note]` Asking Claude to scan git log to deduce learnings is a fast way to bootstrap a devlog retroactively

---

## v1.2.0 — Mobile & Polish (2026-04-06)
**Review:** not yet

**Design docs:**
- Mobile Touch: [Spec](superpowers/specs/2026-04-01-mobile-touch-design.md) [Plan](superpowers/plans/2026-04-01-mobile-touch.md)

**What was built:**
- Full mobile touch support for CubeCanvas (drag to rotate)
- Mobile layout for TimerScreen with overlay sidebar
- Sticky solve detail header and replay section on mobile
- Phase bar touch handling (tooltip stays visible after lift)
- LinkedIn and GitHub attribution links
- Various mobile CSS fixes (overflow, font size, text wrapping)

**Learnings:**
- `[note]` Mobile touch events require careful handling of `touchAction` and empty touch list guards
- `[note]` Sticky positioning inside scroll containers requires specific CSS structure
- `[note]` Small UI polish (attribution, font size, wrapping) takes more commits than expected

---

## v1.1.0 — Roux Method + Slice Moves (2026-04-03 to 2026-04-05)
**Review:** not yet

**Design docs:**
- Roux Method: [Spec](superpowers/specs/2026-04-07-roux-method-design.md) [Plan](superpowers/plans/2026-04-07-roux-method.md)
- Slice Moves: [Spec](superpowers/specs/2026-04-07-slice-moves-design.md) [Plan](superpowers/plans/2026-04-07-slice-moves.md)

**What was built:**
- Roux method phase detection (FB, SB, CMLL, LSE)
- Roux facelet detection utilities with tests
- Method selector dropdown, persisted to localStorage
- `SliceMoveDetector` middleware for M/E/S move detection
- Broadened `Move.face` type to include `SliceFace` and `AnyFace`
- Retroactive slice move correction with `cubeTimestamp`-gated pairing

**Learnings:**
- `[insight]` Slice moves (M/E/S) require middleware that infers the move from two sequential face moves — they're not directly reported by the GAN protocol
- `[insight]` Adding a new solve method requires: detection utils → `SolveMethod` definition → hook integration → UI selector — a clear layered pattern
- `[note]` Phase detection bugs are best caught by comparing against known solve recordings
- `[insight]` `cubeTimestamp` (hardware clock) vs wall clock distinction matters when pairing slice moves retroactively

---

## v1.0.0 — Scramble Tracker + Timer + Solve History (2026-03-31 to 2026-04-02)
**Review:** not yet

**Design docs:**
- Scramble Timer: [Spec](superpowers/specs/2026-03-31-scramble-timer-design.md) [Plan](superpowers/plans/2026-03-31-scramble-timer.md)
- Phase Bar Hover: [Spec](superpowers/specs/2026-04-01-phase-bar-hover-indicator-design.md) [Plan](superpowers/plans/2026-04-01-phase-bar-hover-indicator.md)

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
- `[insight]` State machines are the right model for scramble verification — tracking states (idle → scrambling → armed → solving → solved) prevents edge cases
- `[insight]` Separating "recognition time" from "execution time" per phase requires careful timestamp handling
- `[insight]` Sequential solve IDs need to be persisted independently of the solve list (counter survives deletes)

**Learnings — Claude Code workflow:**
- `[note]` The brainstorm → design spec → implementation plan → execute pipeline produced a clean, well-tested feature with clear scope
- `[note]` TDD (write failing test first, then implement) caught several edge cases in `computeAo` and phase detection
- `[note]` Superpowers skills (brainstorming, writing-plans, executing-plans) provide consistent structure across sessions

---

## v0.4.0 — Example Solves + Button Driver (2026-03-30)
**Review:** not yet

**Design docs:**
- GAN Cube Web App: [Spec](superpowers/specs/2026-03-30-gan-cube-web-app-design.md) [Plan](superpowers/plans/2026-03-30-gan-cube-phase1.md)

**What was built:**
- Example solve records with negative IDs (won't conflict with real solves)
- Button driver for controlling a virtual cube without hardware
- Anchor URLs for solve detail modal (`#solve-<id>`)
- Replaced `cubing.js` WASM scrambler with a simpler random-move generator (removed heavy dependency)

**Learnings:**
- `[insight]` WASM dependencies (like `cubing.js`) add significant bundle size and complexity — a simple random-move generator was sufficient for the use case
- `[note]` Negative IDs for example records is a clean way to distinguish them without a separate type field

---

## v0.3.0 — Replay + Phase Highlighting (2026-03-28)
**Review:** not yet

**What was built:**
- Smooth gyro-interpolated replay of recorded solves
- Phase highlighting in the replay timeline
- CFOP phase grouping (F2L pairs grouped visually)
- Battery indicator with polling
- Draggable sidebar with proportional font scaling

**Learnings:**
- `[insight]` Quaternion interpolation (SLERP) is needed for smooth gyro replay — linear interpolation produces jerky rotation
- `[note]` Replay requires a separate timestamp system (`cubeTimestamp` from hardware) vs wall clock to be accurate
- `[note]` CSS `resize` for a draggable sidebar is simpler than a drag handler but less controllable

---

## v0.2.0 — Layout + Sidebar (2026-03-27)
**Review:** not yet

**What was built:**
- Timer/debug mode toggle
- Solve history sidebar with resizable width (persisted)
- Scramble display with per-step color coding
- Sidebar statistics (single, Ao5, Ao12, Ao100)

**Learnings:**
- `[note]` `localStorage` persistence of UI state (sidebar width, mode) makes the app feel polished with minimal effort
- `[note]` Ao calculation with trimming (drop best/worst) requires careful index handling for edge cases (n ≤ 4)

---

## v0.1.0 — Foundation (2026-03-25 to 2026-03-26)
**Review:** not yet

**What was built:**
- Vite + React + TypeScript scaffold
- `CubeDriver` abstract interface + `GanCubeDriver` wrapping `gan-web-bluetooth`
- `useCubeDriver`, `useCubeState`, `useGyro`, `useGestureDetector`, `useSolveRecorder` hooks
- Three.js `CubeRenderer` with layer animation
- `CubeCanvas`, `ConnectionBar`, `OrientationConfig`, `MoveHistory` components
- 2D facelet debug view
- GitHub Actions CI + GitHub Pages deploy (Node version matching was first CI lesson)

**Learnings — BLE + GAN protocol:**
- `[note]` Web Bluetooth only works in Chromium (Chrome/Edge) — not Firefox or Safari
- `[note]` GAN Gen4 protocol uses AES encryption — `gan-web-bluetooth` handles this, but the cube must be in the right mode
- `[insight]` Face sticker cycles and orientation conventions (green front / yellow bottom) must be established early — they affect everything downstream
- `[insight]` `cubeTimestamp` from hardware is separate from wall clock and drifts — important for replay accuracy

**Learnings — Claude Code workflow:**
- `[note]` Starting with a design spec (phase 1 spec) before any code gave Claude clear constraints and avoided scope creep
- `[insight]` Hooks-based architecture (`useCubeDriver`, `useCubeState`, etc.) maps well to the event-driven BLE model
- `[note]` CI failures early (Node version, `npm ci` vs `npm install`) are cheaper to fix than later
