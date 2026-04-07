# Roux Method Support — Design Spec

**Date:** 2026-04-07
**Status:** Approved

## Overview

Add Roux method support to sans_cube alongside existing CFOP. The solver can select their method via a dropdown before a solve starts. The selected method is persisted to localStorage and recorded in each solve's history entry.

---

## Phase Structure

Roux has 6 phases:

| Phase   | Group | Description                                              |
|---------|-------|----------------------------------------------------------|
| FB      | —     | First Block (L or R, yellow base)                        |
| SB      | —     | Second Block (the other side, yellow base)               |
| CMLL    | —     | Corners of the Last Layer (M-slice edges ignored)        |
| EO      | LSE   | Edge Orientation — all 6 LSE edges oriented              |
| UL+UR   | LSE   | UL and UR edges placed and oriented                      |
| EP      | LSE   | Last 4 edges permuted (cube solved)                      |

EO, UL+UR, and EP share `group: 'LSE'`, mirroring how F2L slots share `group: 'F2L'` in CFOP.

---

## Orientation Assumptions

All detection is hardcoded to:
- **Yellow bottom (D)**
- **White top (U)**
- **Orange left (L)**
- **Red right (R)**

This matches the solver's physical hold for standard Roux. The code is structured to extend to arbitrary orientation (color-neutral) in the future by expanding the detection functions without changing the interface.

---

## Facelet Detection (`src/utils/roux.ts`)

All functions take a 54-char facelet string and return boolean, identical style to `src/utils/cfop.ts`.

### Block detection

- `isLDBlockDone(f)` — L center + DFL/DBL corners + DL/FL/BL edges all solved
- `isRDBlockDone(f)` — R center + DFR/DBR corners + DR/FR/BR edges all solved
- `isFirstBlockDone(f)` = `isLDBlockDone(f) || isRDBlockDone(f)`
- `isSecondBlockDone(f)` = `isLDBlockDone(f) && isRDBlockDone(f)`

**Future extensibility:** to support arbitrary base edges (not just yellow), expand `isFirstBlockDone` to check additional (face, base) pairs. To support color-neutral (any center as block face), check all 24 possible (face, base-edge) combinations. The `isLDBlockDone` / `isRDBlockDone` helpers remain unchanged.

### CMLL

`isCMLLDone(f)` — all 4 U-layer corners are solved: each corner's 3 stickers match their respective face centers. M-slice edges are ignored (they may still be scrambled).

### EO

`isEODone(f)` — all 6 LSE edges are oriented, meaning their U/D-colored sticker faces U or D:
- M-slice edges: UF, UB, DF, DB
- Column edges: UL, UR

### UL+UR

`isULURDone(f)` — both UL and UR edges are in the correct position **and** correctly oriented (U sticker faces U, side sticker matches its face center).

### EP

Reuses `isSolvedFacelets` from `useCubeState` — no new function needed.

---

## Method Definition (`src/methods/roux.ts`)

```ts
export const ROUX: SolveMethod = {
  id: 'roux',
  label: 'Roux',
  phases: [
    { label: 'FB',    color: '...', isComplete: isFirstBlockDone },
    { label: 'SB',    color: '...', isComplete: isSecondBlockDone },
    { label: 'CMLL',  color: '...', isComplete: isCMLLDone },
    { label: 'EO',    group: 'LSE', color: '...', isComplete: isEODone },
    { label: 'UL+UR', group: 'LSE', color: '...', isComplete: isULURDone },
    { label: 'EP',    group: 'LSE', color: '...', isComplete: isSolvedFacelets },
  ],
}
```

Colors are chosen to visually distinguish phases; exact values decided at implementation time.

---

## Type Changes (`src/types/solve.ts`)

Add one optional field to `SolveRecord`:

```ts
method?: string   // e.g. 'cfop' or 'roux'; absent on old solves, treated as 'cfop'
```

No other type changes required.

---

## Method Hook (`src/hooks/useMethod.ts`)

- Reads selected method id from `localStorage` on mount; defaults to `'cfop'` if absent
- Returns `{ method: SolveMethod, setMethod: (m: SolveMethod) => void }`
- Writes to `localStorage` on change
- Uses a new key `STORAGE_KEYS.METHOD`

---

## Method Selector UI (`src/components/MethodSelector.tsx`)

- `<select>` dropdown with options "CFOP" and "Roux"
- Disabled when `status === 'solving'`
- Placed just above `<PhaseBar>` in `TimerScreen`, below `<CubeCanvas>`
- On change: updates method and calls `resetTimer()` to clear in-progress phase state

---

## TimerScreen Changes (`src/components/TimerScreen.tsx`)

- Replace hardcoded `CFOP` with `useMethod()` — pass `method` to `useTimer` and `PhaseBar`
- Render `<MethodSelector>` between `<CubeCanvas>` and `<PhaseBar>`
- Save `method: method.id` to `SolveRecord` at solve completion

---

## Solve Display

**`SolveHistorySidebar`** — show method label ("CFOP" / "Roux") per row. Solves with no `method` field display as "CFOP".

**`SolveDetailModal`** — show method label in the header/summary area. Same fallback to "CFOP".

---

## Storage

New localStorage key added to `src/utils/storageKeys.ts`:

```ts
METHOD: 'method'
```

---

## Out of Scope

- ZZ method (tracked in `future.md`)
- Color-neutral block detection (tracked in `future.md`)
- Arbitrary cube orientation during Roux (tracked in `future.md`)
