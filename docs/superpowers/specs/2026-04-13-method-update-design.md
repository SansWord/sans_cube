# Design: Method Update in SolveDetailModal

**Date:** 2026-04-13

## Overview

Allow a user to change the method (`cfop` ↔ `roux`, extensible to future methods) on an existing `SolveRecord` from within `SolveDetailModal`. Changing the method recomputes phases from the stored moves and persists the updated record to localStorage or Firestore depending on cloud sync state.

---

## 1. Phase Recompute Utility

**File:** `src/utils/recomputePhases.ts` (new)

**Signature:**
```ts
export function recomputePhases(solve: SolveRecord, newMethod: SolveMethod): PhaseRecord[]
```

**Logic:**
1. Reconstruct `scrambledFacelets` from `solve.scramble` (same logic as `SolveDetailModal.computeScrambledFacelets`)
2. Replay `solve.moves` one by one, applying each to facelets
3. Track phase completion by calling `phase.isComplete(facelets)` after each move, advancing through phases as they complete (same while-loop pattern as `useTimer`)
4. Compute timing from `cubeTimestamp` diffs (the `hwOffset` cancels in relative diffs):
   - Phase 0: `phaseStart = moves[0].cubeTimestamp`, so `recognitionMs = 0`
   - Phase N start = completing timestamp of phase N-1 (timestamp of last move in that phase)
   - First move of phase N = first move after previous phase ended
   - `recognitionMs = firstMove.cubeTimestamp - phaseStart`
   - `executionMs = lastMove.cubeTimestamp - firstMove.cubeTimestamp`
   - `turns` = number of moves in that phase
5. Apply the same merge rules from `useTimer` (matched by label name, so they are a no-op for non-CFOP methods):
   - If EOLL completed OLL on the same move (COLL has 0 turns): absorb EOLL into COLL
   - If CPLL and EPLL finished on the same move (EPLL has 0 turns): absorb CPLL into EPLL

**Return value:** `PhaseRecord[] | null` — returns `null` if the cube is not in a solved state after replaying all moves (signals a corrupt or incomplete solve record). The caller must handle `null` by aborting the update.

**Notes:**
- The function is pure (no side effects) and method-agnostic — works for any `SolveMethod` with any number of phases

---

## 2. Persistence Layer

### `src/services/firestoreSolves.ts`

Add:
```ts
export async function updateSolveInFirestore(uid: string, solve: SolveRecord): Promise<void>
```
Implementation: `setDoc(solveDocRef(uid, solve), sanitize(solve))` — same as `addSolveToFirestore`, idempotent.

### `src/hooks/useSolveHistory.ts`

Add `updateSolve` to the hook return value:
```ts
updateSolve: (updated: SolveRecord) => Promise<void>
```

- **localStorage mode:** replaces the solve with matching `id` in the array, saves via `saveLocalSolves`
- **Firestore mode:** calls `updateSolveInFirestore(uid, updated)`

The function returns a `Promise<void>` so callers can await it and react to completion (e.g. re-enable UI).

---

## 3. SolveDetailModal

### Props change

Add:
```ts
onUpdate: (solve: SolveRecord) => Promise<void>
```

### Local state

```ts
const [localSolve, setLocalSolve] = useState(solve)
const [saving, setSaving] = useState(false)
const [methodError, setMethodError] = useState<string | null>(null)
```

All existing references to `solve` inside the modal switch to `localSolve`. `method` is derived from `localSolve.method` (already done via `getMethod`).

### Method change handler

```ts
async function handleMethodChange(newMethod: SolveMethod) {
  const newPhases = recomputePhases(localSolve, newMethod)
  if (newPhases === null) {
    setMethodError('Could not recompute phases — solve record appears incomplete.')
    setTimeout(() => setMethodError(null), 4000)
    return  // abort: do not update localSolve or call onUpdate
  }
  const updated = { ...localSolve, method: newMethod.id, phases: newPhases }
  setLocalSolve(updated)   // optimistic update for immediate UI feedback
  setSaving(true)
  try {
    await onUpdate(updated)
  } finally {
    setSaving(false)
  }
}
```

### UI change

In the "Detailed Analysis" header, replace:
```tsx
<span style={{ color: '#888', fontSize: 12 }}>{method.label}</span>
```
With:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
  <MethodSelector method={method} onChange={handleMethodChange} disabled={saving} />
  {methodError && <span style={{ color: '#e74c3c', fontSize: 11 }}>{methodError}</span>}
</div>
```

### Disabled during save

- `MethodSelector`: disabled via `saving` prop (already part of its API)
- Delete button: disabled when `saving` is true

---

## 4. Call Sites

Wherever `SolveDetailModal` is rendered (currently `TimerScreen.tsx`), pass the new prop:
```tsx
onUpdate={async (updated) => { await updateSolve(updated) }}
```

`updateSolve` comes from `useSolveHistory`.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/utils/recomputePhases.ts` | New — pure phase recompute utility |
| `src/services/firestoreSolves.ts` | Add `updateSolveInFirestore` |
| `src/hooks/useSolveHistory.ts` | Add `updateSolve`, return it from hook |
| `src/components/SolveDetailModal.tsx` | Add `onUpdate` prop, local solve state, `MethodSelector`, saving state |
| `src/components/TimerScreen.tsx` | Pass `onUpdate` to `SolveDetailModal` |

---

## 6. Out of Scope

- No change to `useMethod` (timer-screen method selection is independent)
- No migration of old solves — they keep their existing method and phases until the user explicitly changes them
- No undo/redo
