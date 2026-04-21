# Resequence Scope Preview — design notes

**Status:** ready for implementation (captured 2026-04-21)

## Why this exists

The debug-mode "Renumber solves (fix seq)" action in `src/App.tsx:292-306` currently uses a plain `confirm()` prompt — *"Renumber all cloud solves 1..n by date? This cannot be undone."* — with no indication of scope. The user can't see how many documents will be touched or which solve is the first mismatch until the operation completes. For a user with hundreds of cloud solves, the prompt feels blind.

This spec replaces the inline button + `confirm()` with a debug panel that previews the scope (total count, first-mismatch cursor, renumber count) before the user commits.

The same work also extracts a shared presentational shell (`<DebugPanel>`) so this and `<RecomputePhasesPanel>` stop duplicating box/title/warning chrome, and so future debug panels have a place to land.

## Who is affected

- **Cloud-sync users** with Firestore solves. Local-only users never see this panel (disabled when cloud sync is off).
- **Users with imported solves** whose `seq` values aren't a contiguous 1..n run. Today, the existing renumber rewrites every row — losing any deliberately-preserved historical seq values. This spec changes semantics to tail-only: preserve earlier rows even if they aren't 1..n, and only renumber from the first mismatch forward.

## Existing machinery (don't re-build)

- `src/services/firestoreSolves.ts:64-75` — `renumberSolvesInFirestore(uid): Promise<number>`. Current implementation: load all solves ordered by date, compute target seq = `i + 1` for each, filter to changed rows, write via `Promise.all(setDoc)`, update counter. Returns `nextSeq = n + 1`.
- `src/services/firestoreSolves.ts` — `bulkUpdateSolvesInFirestore(uid, updatedSolves, onProgress)`. Chunked writer used by `RecomputePhasesPanel`. Chunks of 100, `onProgress(batchIndex, batchCount)` callback for "batch X of Y" UX. Handles per-doc error aggregation.
- `src/services/firestoreSolves.ts` — `updateCounterInFirestore(uid, nextSeq)`. Single-doc write to the counter.
- `src/services/firestoreSolves.ts:32-36` — `loadSolvesFromFirestore` already uses `orderBy('date', 'asc')`, but we'll sort defensively in-memory anyway.
- `src/components/RecomputePhasesPanel.tsx` — self-contained panel precedent: state machine `idle → scanning → results → committing → committed`, `boxStyle` container, `buttonStyle(color, disabled)` helper, warning banner, `onSolveClick` pattern for clickable solve id links. This spec refactors it to use the new `<DebugPanel>` shell (no behavior change).
- `src/stores/solveStore.ts` — `runBulkOp`, `getSnapshot`, `reload` (async Firestore reload). Already used by the existing renumber button and by `<RecomputePhasesPanel>`.

## Behavior change: tail-only renumber semantics

Today, `renumberSolvesInFirestore` renumbers strictly `1..n` across the whole list. This overwrites any historical seq values before the first mismatch — a risk for users with imported solves.

**New semantics:** scan front-to-back for the first index where `solves[i].seq !== i + 1` (the **firstMismatch cursor**). Renumber only the tail slice starting at that index, and within the tail, filter to only rows whose current seq actually differs from the target.

The counter is always updated to `n + 1`, regardless of whether any writes occurred.

## Proposed feature

### 1. Revised `renumberSolvesInFirestore`

**New signature:**
```ts
renumberSolvesInFirestore(
  uid: string,
  onProgress?: (batchIndex: number, batchCount: number) => void,
): Promise<{
  nextSeq: number
  renumbered: number
  firstMismatchIndex: number
  firstMismatchSolve: SolveRecord | null
}>
```

**Logic:**
```ts
const raw = await loadSolvesFromFirestore(uid)
const solves = [...raw].sort((a, b) => a.date - b.date)   // defensive
const nextSeq = solves.length + 1
const firstMismatchIndex = solves.findIndex((s, i) => s.seq !== i + 1)

if (firstMismatchIndex === -1) {
  await updateCounterInFirestore(uid, nextSeq)
  return { nextSeq, renumbered: 0, firstMismatchIndex: -1, firstMismatchSolve: null }
}

const changed: SolveRecord[] = []
for (let i = firstMismatchIndex; i < solves.length; i++) {
  const target = i + 1
  if (solves[i].seq !== target) {
    changed.push({ ...solves[i], seq: target })
  }
}

await bulkUpdateSolvesInFirestore(uid, changed, onProgress ?? (() => {}))
await updateCounterInFirestore(uid, nextSeq)

return {
  nextSeq,
  renumbered: changed.length,
  firstMismatchIndex,
  firstMismatchSolve: solves[firstMismatchIndex],
}
```

**Ordering note (crash-safety):** counter update runs **after** `bulkUpdateSolvesInFirestore` resolves. If the chunked writes reject partway, the counter is not advanced — avoids a counter that points past writes that didn't happen. If the counter update itself fails, the writes are already durable; the next sign-in recomputes `nextSeq` from the loaded solves on reload.

**Callsite update in `App.tsx`:** the caller currently extracts `nextSeq` from the return and stores it to `localStorage` — now it reads `result.nextSeq` instead. No other semantic change at the callsite.

### 2. New pure helper `previewRenumberScope`

**File:** `src/utils/previewRenumberScope.ts` (new).

```ts
export interface RenumberScope {
  totalCount: number
  firstMismatchIndex: number
  firstMismatchSolve: SolveRecord | null
  renumberedCount: number
}

export function previewRenumberScope(solves: SolveRecord[]): RenumberScope {
  const sorted = [...solves].sort((a, b) => a.date - b.date)
  const totalCount = sorted.length
  const firstMismatchIndex = sorted.findIndex((s, i) => s.seq !== i + 1)
  if (firstMismatchIndex === -1) {
    return { totalCount, firstMismatchIndex: -1, firstMismatchSolve: null, renumberedCount: 0 }
  }
  let renumberedCount = 0
  for (let i = firstMismatchIndex; i < sorted.length; i++) {
    if (sorted[i].seq !== i + 1) renumberedCount++
  }
  return {
    totalCount,
    firstMismatchIndex,
    firstMismatchSolve: sorted[firstMismatchIndex],
    renumberedCount,
  }
}
```

Pure, no I/O. Shares the same sort + filter logic as `renumberSolvesInFirestore` — so the preview count and commit count agree by construction (modulo races where a solve arrives from another tab between preview and commit; see edge cases).

### 3. New `<DebugPanel>` shell component

**File:** `src/components/DebugPanel.tsx` (new).

**Props:**
```ts
interface DebugPanelProps {
  title: string
  warning?: React.ReactNode
  disabled?: boolean
  disabledHint?: React.ReactNode
  children: React.ReactNode
}
```

**Render:**
- `boxStyle` container (lifted verbatim from `RecomputePhasesPanel`: `fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc', padding: '12px 16px', borderRadius: 6, marginTop: 8`).
- Title row: bold, `color: '#aaa'`, `marginBottom: 6`.
- Optional warning row: `color: '#e8a020'`, `marginBottom: 8`.
- When `disabled`:
  - Render `disabledHint` above the children (if provided).
  - Wrap `children` in a `<div style={{ opacity: 0.5, pointerEvents: 'none' }}>`.
- When not disabled:
  - Render `children` normally (no wrapper div).

Also exports the shared `buttonStyle` helper:
```ts
export function buttonStyle(color: string, disabled = false): React.CSSProperties {
  return {
    alignSelf: 'flex-start', padding: '3px 10px', cursor: disabled ? 'default' : 'pointer',
    background: '#222', color, border: `1px solid ${color}`, borderRadius: 3, fontSize: 11,
    opacity: disabled ? 0.6 : 1,
  }
}
```

### 4. New `<ResequenceScopePanel>` component

**File:** `src/components/ResequenceScopePanel.tsx` (new).

**Props:**
```ts
interface ResequenceScopePanelProps {
  disabled: boolean
  loadSolves: () => SolveRecord[]
  commit: (onProgress: (batch: number, total: number) => void) => Promise<number>
  // commit's returned number = renumbered count, shown in the committed-state message.
}
```

**State machine (local):**
```
idle        → user clicks "Preview renumber scope" → ready
ready       → user clicks "Commit" → committing
ready       → user clicks "Cancel" → idle
committing  → commit promise resolves with N → committed(N)
committed   → after 3000ms → idle
```

No separate `previewing` state; the scan is a synchronous in-memory computation.

**Render by state, wrapped in `<DebugPanel title="Resequence solves (Firestore)" warning={…} disabled={disabled} disabledHint={…}>`:**

- `idle` — single button `[Preview renumber scope]` using `buttonStyle('#3498db')`.
- `ready` — preview block:
  - `Total solves: {scope.totalCount}`.
  - If `scope.firstMismatchIndex === -1`: `✓ All solves already sequential. Nothing to renumber.`
  - Else: `First mismatch: #{scope.firstMismatchSolve.id} ({formatDate(scope.firstMismatchSolve.date)}) — stored seq {firstMismatchSolve.seq}, should be {firstMismatchIndex + 1}`.
  - If `scope.renumberedCount > 0`: `Will renumber {scope.renumberedCount} solves.`
  - Buttons row: `[Commit N changes]` (uses `buttonStyle('#e8a020', renumberedCount === 0)`, disabled when `renumberedCount === 0`) and `[Cancel]` (uses `buttonStyle('#888')`).
- `committing` — `Renumbering... batch {batch} of {total}` in `color: '#e8a020'`.
- `committed` — `✓ Renumbered {count} solves.` in `color: '#4c4'`.

**Warning prop content:**
```tsx
<>⚠️ Rewrites <code>seq</code> on Firestore solves starting at the first mismatch.
Back up your data first (see <code>docs/data-backup.md</code>).</>
```

**Disabled hint content:**
```tsx
<>Requires cloud sync. Sign in and enable cloud sync in the Cloud Sync panel above.</>
```

**Solve id rendering:** Per the Section 2 decision, `#{id}` in the preview renders as plain text — no `onSolveClick` prop on this panel.

**After-commit side effects** live in the commit callback closure (passed by `App.tsx`), not inside the panel. Panel just awaits and shows the returned count.

### 5. Refactor `<RecomputePhasesPanel>` onto `<DebugPanel>`

No behavior change. Move `boxStyle` and the title/warning rendering into the `<DebugPanel>` wrapper; import `buttonStyle` from `DebugPanel.tsx` instead of defining it locally.

**Before (`RecomputePhasesPanel.tsx:95-103`):**
```tsx
return (
  <div style={boxStyle}>
    <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#aaa' }}>
      Recompute phases ({targetLabel})
    </div>
    <div style={{ color: '#e8a020', marginBottom: 8 }}>
      ⚠️ This rewrites every solve's <code>phases</code> array. …
    </div>
    {/* …body… */}
```

**After:**
```tsx
return (
  <DebugPanel
    title={`Recompute phases (${targetLabel})`}
    warning={<>⚠️ This rewrites every solve's <code>phases</code> array. …</>}
  >
    {/* …body… */}
  </DebugPanel>
)
```

Delete the local `boxStyle` const and the local `buttonStyle` function in `RecomputePhasesPanel.tsx`.

### 6. `App.tsx` wiring

**Remove:**
- `const [renumbering, setRenumbering] = useState<'idle' | 'running' | 'done'>('idle')` at `src/App.tsx:82`.
- The `<button>…Renumber solves (fix seq)…</button>` block at `src/App.tsx:292-306`.

**Keep:**
- All existing imports. `renumberSolvesInFirestore` is still used — now via the panel's commit callback.

**Add** (below `<RecomputePhasesPanel>` around `src/App.tsx:418-435`):
```tsx
<ResequenceScopePanel
  disabled={!(cloudSync.enabled && cloudSync.user)}
  loadSolves={() => solveStore.getSnapshot().solves}
  commit={async (onProgress) => {
    const result = await solveStore.runBulkOp(() =>
      renumberSolvesInFirestore(cloudSync.user!.uid, onProgress)
    )
    localStorage.setItem(STORAGE_KEYS.NEXT_ID, String(result.nextSeq))
    await solveStore.reload()
    return result.renumbered
  }}
/>
```

No other `App.tsx` changes.

## Non-goals

- **No localStorage variant of the panel.** Local-mode seq is managed by `NEXT_ID` alone; no multi-document resequence problem exists. The panel is disabled in local mode with a hint pointing the user to the Cloud Sync panel.
- **No `useDryRunPanel` state-machine hook extraction.** Only the presentational shell is extracted. The two panels have different state shapes (scan+results vs. preview+ready) and different commit UX (batch progress only in commit for recompute; batch progress in commit for resequence — but entirely different preview bodies). Revisit only if a third panel shows the hook is actually needed.
- **No rollback, no undo, no transactional dry-run.** Backup via `docs/data-backup.md` is the user's safety net. The warning banner directs them there.
- **No retry on per-doc failure during commit.** `bulkUpdateSolvesInFirestore` already collects failures; the panel surfaces any thrown error via React's normal error propagation — same as `<RecomputePhasesPanel>`.
- **No migration of the other cloud-section buttons** (recalibrate-cloud, v2-migrate) to panels. Out of scope; can happen later if desired.

## Edge cases

- **Zero solves.** Preview: `Total solves: 0 · ✓ All solves already sequential. Nothing to renumber.` Commit disabled. Commit callback never invoked.
- **All seq already 1..n.** Same render as above (Commit disabled, visible). The underlying `renumberSolvesInFirestore` still updates the counter if somehow called — belt-and-suspenders.
- **Cloud sync disabled mid-preview.** `disabled` prop flips on next render; `<DebugPanel>` dims children + shows hint. Panel state doesn't reset — if the user re-enables cloud sync they resume where they left off. If they click Commit while dimmed, `pointerEvents: 'none'` blocks the click. No special state handling.
- **User signs out during commit.** `cloudSync.user!` would throw at the callsite closure. Same risk as today's button; the commit rejects and the panel's `await` propagates the error. Not guarded against in this spec.
- **Another tab adds/deletes a solve between preview and commit.** Preview uses in-memory `solveStore` snapshot; commit re-reads Firestore. The ✓ message shows the actual committed count (from `result.renumbered`), not the preview count. Minor visual surprise; no guard added.
- **Unsorted store snapshot.** Both `previewRenumberScope` and `renumberSolvesInFirestore` sort defensively. Same filter logic in both places → preview count and commit count agree for the same input.
- **Tail row coincidentally matches target seq.** Skipped by the filter in both preview and commit. Example: target `[1,2,3,4,5]`, stored `[1,2,4,4,5]` → firstMismatch at index 2, filtered writes = `{i:2 target:3}` and the `i:4 target:5` is already-correct so skipped. `renumberedCount: 1`.
- **Counter update fails after writes succeed.** Writes are durable; counter is stale. On next sign-in, `loadNextSeqFromFirestore` returns a now-wrong value. The next add-solve would collide with an existing doc id. Not guarded in this spec — same exposure as the current renumber. (Could be improved separately by recomputing `nextSeq` from the counter vs. max-seq at sign-in time, but out of scope.)

## Files touched

**New:**
- `src/utils/previewRenumberScope.ts` — pure preview helper.
- `src/utils/previewRenumberScope.test.ts` — unit tests.
- `src/components/DebugPanel.tsx` — shared shell + `buttonStyle` helper.
- `src/components/ResequenceScopePanel.tsx` — the panel.

**Modified:**
- `src/services/firestoreSolves.ts` — update `renumberSolvesInFirestore` signature and logic (tail-only, chunked via existing `bulkUpdateSolvesInFirestore`, counter update after writes, expanded return shape).
- `src/components/RecomputePhasesPanel.tsx` — refactor onto `<DebugPanel>`; remove local `boxStyle` and `buttonStyle`; import `buttonStyle` from `DebugPanel`.
- `src/App.tsx` — remove renumber button + state; add `<ResequenceScopePanel>` to the panel stack.
- `docs/debug-mode.md` — remove the "Renumber solves (fix seq)" bullet from Cloud Sync; add a new bullet under maintenance toolbar describing the panel (shows total, first-mismatch cursor, renumber count; cloud-only with disabled hint; reloads via `solveStore.reload()`).
- `docs/ui-architecture.md` — add `DebugPanel` and `ResequenceScopePanel` to the components list; reflect new `App.tsx` panel stack.
- `future.md` — strike through the "Resequence: show scope before confirming" bullet at ship time (per ship-it flow).
- `docs/devlog.md` — new entry at ship time (not part of this spec).

**Tests:**
- **Primary coverage — `tests/utils/previewRenumberScope.test.ts` (new):** empty solves, all-seq-correct, full-mismatch, tail-mismatch, mixed-skip (tail row coincidentally matching target), unsorted-input (asserts defensive sort). Since `previewRenumberScope` shares its sort + filter logic with `renumberSolvesInFirestore` by design, these tests indirectly cover the core behavior of both.
- **`renumberSolvesInFirestore` integration coverage:** no existing `tests/services/firestoreSolves.test.ts` — creating one just for this function requires mocking `loadSolvesFromFirestore`, `bulkUpdateSolvesInFirestore`, and `updateCounterInFirestore`. Defer to **manual QA** (preview → commit → verify Firestore data + `NEXT_ID` + counter doc via the Firebase console), following the pattern used for the existing recalibrate and v2-migrate actions which also don't have unit coverage. Spec-ship this decision explicitly; do not silently skip.
- **Existing `tests/components/RecomputePhasesPanel.test.tsx`:** must still pass after the `<DebugPanel>` refactor. If the tests assert on specific DOM structure (e.g., outer div style, header text selectors), they may need minor updates to account for the `<DebugPanel>` wrapper. Behavior-level assertions (buttons, counts, commit callback) should not need changes. Verify early in implementation.

## Verified facts (2026-04-21)

- `src/App.tsx:22` — `renumberSolvesInFirestore` is imported from `./services/firestoreSolves` and currently called only by the button at `:292-306`.
- `src/App.tsx:82` — `renumbering` state is declared and used only by that button.
- `src/App.tsx:292-306` — the button is inside the Cloud Sync (Firebase) panel, gated on signed-in state. Uses `confirm()`, calls `solveStore.runBulkOp(() => renumberSolvesInFirestore(...))`, persists `NEXT_ID`, shows "Done! Reloading...", then `setTimeout(..., 1000)` → `window.location.reload()`.
- `src/App.tsx:307-313` — the "Refresh solves" button already uses `solveStore.reload()` (proven pattern, no page reload).
- `src/services/firestoreSolves.ts:64-75` — current `renumberSolvesInFirestore` signature is `(uid) => Promise<number>`, returns `nextSeq`. Uses `Promise.all` across all changed rows (no chunking, no progress).
- `src/services/firestoreSolves.ts:32-36` — `loadSolvesFromFirestore` uses `orderBy('date', 'asc')`.
- `src/components/RecomputePhasesPanel.tsx` — uses `boxStyle` const + local `buttonStyle` helper. State machine is the precedent; `onSolveClick` is optional.
- `src/stores/solveStore.ts:301` — `reload()` is async.
- `docs/superpowers/specs/2026-04-20-bulk-recompute-phases-design.md` — establishes the "chunks of 100" sizing rationale for Firestore writes (10 MB batch limit vs. ~35 KB per solve). Same reasoning applies here since renumber writes full solve docs.

## Resolved design decisions (2026-04-21 brainstorm)

1. **Preview depth.** Approach A (minimal) with a **first-mismatch cursor**. Counts plus one cursor line showing `#id (date) — stored seq X, should be Y`. No sample table. Rationale: scope is conveyed by count + cursor; the existing renumber's by-date 1..n invariant means a single cursor tells the whole story.
2. **Commit button when zero mismatches.** Visible, disabled. Shape stays stable across the "nothing to do" state so the panel looks the same shape in all states.
3. **Reusable panel abstraction shape.** Approach A (presentational shell only). Extract `<DebugPanel>` + `buttonStyle` helper; leave state machines local per panel. Revisit hooks/generic-component extraction only if a third panel proves it's needed.
4. **Panel placement.** Below `<RecomputePhasesPanel>` in the maintenance-toolbar panel stack, not inside the Cloud Sync section. Disabled-with-hint when cloud sync isn't enabled.
5. **Reload behavior on success.** `solveStore.reload()` — no page reload, no `setTimeout`. Matches the "Refresh solves" button's pattern.
6. **Renumber semantics.** Tail-only: preserve earlier rows that aren't 1..n; renumber from first mismatch forward. Within the tail, filter to only rows whose current seq actually differs from the target (don't blindly rewrite).
7. **Write strategy.** Reuse `bulkUpdateSolvesInFirestore` (chunks of 100, progress callback). Counter update runs **after** all chunks succeed.
8. **Defensive sort.** Both `previewRenumberScope` and `renumberSolvesInFirestore` sort by date ascending before scanning, even though `loadSolvesFromFirestore` and the store snapshot are expected to be sorted.
9. **Disabled rendering.** `<DebugPanel disabled>` dims children with `opacity: 0.5, pointerEvents: 'none'` and shows `disabledHint` above the children. Children stay visible (dimmed) so the user sees the panel's shape.
10. **Solve id click handler.** Not included on `<ResequenceScopePanel>` — `#id` renders as plain text. `<RecomputePhasesPanel>`'s `onSolveClick` prop is unaffected.
