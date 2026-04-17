# Hash Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3 independent `hashchange` listeners scattered across `App.tsx`, `TimerScreen.tsx`, and `useSharedSolve.ts` with a single `useHashRouter` hook that owns one listener, parses the hash into a typed `Route`, and exposes it as React state.

**Architecture:** `useHashRouter` is called once in `App.tsx` and `currentRoute` is passed down as a prop. All hash parsing is centralized in `parseHash` (pure function). Components react to `currentRoute` via `useEffect` — no raw `window.location.hash` reads outside the hook. Write-backs (`pushState` / `replaceState`) stay in components; the hook is read-only.

**Tech Stack:** React 19 + TypeScript, Vitest for tests. No new dependencies.

---

## File Map

| File | Change |
|---|---|
| `src/hooks/useHashRouter.ts` | **New** — `Route` type, `TrendsHashParams`, `parseHash`, `useHashRouter` |
| `tests/hooks/useHashRouter.test.ts` | **New** — unit tests for `parseHash` |
| `src/App.tsx` | Call `useHashRouter`, pass `currentRoute` to `TimerScreen`, remove listener, switch to `replaceState` |
| `src/components/TimerScreen.tsx` | Accept `currentRoute` prop, remove listener, update all URL write-backs, update boot resolution |
| `src/hooks/useSharedSolve.ts` | Accept `currentRoute` param, remove listener + boot effect, remove URL writes from `doLoad` |
| `src/components/TrendsModal.tsx` | Accept `initialParams` prop, remove `parseHashParams()` init, switch to `pushState`/`replaceState`, add `detailOpen` guard |
| `docs/url-routes.md` | Update architecture section to reflect new routing design |

---

## Task 1: `useHashRouter.ts` — types and `parseHash`

**Files:**
- Create: `src/hooks/useHashRouter.ts`

- [ ] **Step 1: Create the file with types and `parseHash`**

```ts
// src/hooks/useHashRouter.ts
import { useState, useEffect } from 'react'

export interface TrendsHashParams {
  tab: 'total' | 'phases'
  windowSize: 25 | 50 | 100 | 'all' | null
  grouped: boolean
  totalToggle: { exec: boolean; recog: boolean; total: boolean }
  phaseToggle: { exec: boolean; recog: boolean; total: boolean }
  method: 'all' | 'cfop' | 'roux' | null
  driver: 'all' | 'cube' | 'mouse' | null
}

export type Route =
  | { type: 'debug' }
  | { type: 'solve'; id: number }
  | { type: 'shared'; shareId: string }
  | { type: 'trends'; params: TrendsHashParams }
  | { type: 'none' }

function parseTimeToggle(raw: string | null): { exec: boolean; recog: boolean; total: boolean } {
  const set = new Set((raw ?? '').split(','))
  const t = { exec: set.has('exec'), recog: set.has('recog'), total: set.has('total') }
  if (!t.exec && !t.recog && !t.total) t.total = true
  return t
}

function parseTrendsParams(hash: string): TrendsHashParams {
  const search = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(search)
  const tab: 'total' | 'phases' = params.get('tab') === 'phases' ? 'phases' : 'total'
  const w = params.get('window')
  const windowSize: 25 | 50 | 100 | 'all' | null =
    w === 'all' ? 'all' : w === '50' ? 50 : w === '100' ? 100 : w === '25' ? 25 : null
  const grouped = params.get('group') !== 'split'
  const totalToggle = parseTimeToggle(params.get('ttotal'))
  const ptRaw = params.get('tphase') ?? 'total'
  const ptSet = new Set(ptRaw.split(','))
  const phaseToggle = { exec: ptSet.has('exec'), recog: ptSet.has('recog'), total: ptSet.has('total') }
  if (!phaseToggle.exec && !phaseToggle.recog && !phaseToggle.total) phaseToggle.total = true
  const methodRaw = params.get('method')
  const method = (['all', 'cfop', 'roux'] as const).includes(methodRaw as 'all')
    ? (methodRaw as 'all' | 'cfop' | 'roux')
    : null
  const driverRaw = params.get('driver')
  const driver = (['all', 'cube', 'mouse'] as const).includes(driverRaw as 'all')
    ? (driverRaw as 'all' | 'cube' | 'mouse')
    : null
  return { tab, windowSize, grouped, totalToggle, phaseToggle, method, driver }
}

export function parseHash(hash: string): Route {
  if (hash === '#debug') return { type: 'debug' }
  if (hash.startsWith('#solve-')) {
    const id = parseInt(hash.slice('#solve-'.length), 10)
    return isNaN(id) ? { type: 'none' } : { type: 'solve', id }
  }
  if (hash.startsWith('#shared-')) {
    const shareId = hash.slice('#shared-'.length)
    return shareId ? { type: 'shared', shareId } : { type: 'none' }
  }
  if (hash.startsWith('#trends')) {
    return { type: 'trends', params: parseTrendsParams(hash) }
  }
  return { type: 'none' }
}

export function useHashRouter(): { currentRoute: Route } {
  const [currentRoute, setCurrentRoute] = useState<Route>(
    () => parseHash(window.location.hash)
  )

  useEffect(() => {
    const handler = () => setCurrentRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', handler)
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('hashchange', handler)
      window.removeEventListener('popstate', handler)
    }
  }, [])

  return { currentRoute }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no errors mentioning `useHashRouter.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHashRouter.ts
git commit -m "feat: add useHashRouter hook with parseHash and Route type"
```

---

## Task 2: Tests for `parseHash`

**Files:**
- Create: `tests/hooks/useHashRouter.test.ts`

- [ ] **Step 1: Write tests**

```ts
// tests/hooks/useHashRouter.test.ts
import { describe, it, expect } from 'vitest'
import { parseHash } from '../../src/hooks/useHashRouter'

describe('parseHash', () => {
  it('parses #debug', () => {
    expect(parseHash('#debug')).toEqual({ type: 'debug' })
  })

  it('parses #solve-{id}', () => {
    expect(parseHash('#solve-42')).toEqual({ type: 'solve', id: 42 })
  })

  it('returns none for non-numeric #solve', () => {
    expect(parseHash('#solve-abc')).toEqual({ type: 'none' })
  })

  it('returns none for empty #solve', () => {
    expect(parseHash('#solve-')).toEqual({ type: 'none' })
  })

  it('parses #shared-{shareId}', () => {
    expect(parseHash('#shared-abc123xyz')).toEqual({ type: 'shared', shareId: 'abc123xyz' })
  })

  it('returns none for empty #shared', () => {
    expect(parseHash('#shared-')).toEqual({ type: 'none' })
  })

  it('parses #trends with no params', () => {
    const route = parseHash('#trends')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.tab).toBe('total')
    expect(route.params.windowSize).toBeNull()
    expect(route.params.grouped).toBe(true)
    expect(route.params.method).toBeNull()
    expect(route.params.driver).toBeNull()
  })

  it('parses #trends with all params', () => {
    const route = parseHash('#trends?tab=phases&window=50&group=split&ttotal=exec,recog&tphase=total&method=cfop&driver=cube')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.tab).toBe('phases')
    expect(route.params.windowSize).toBe(50)
    expect(route.params.grouped).toBe(false)
    expect(route.params.totalToggle).toEqual({ exec: true, recog: true, total: false })
    expect(route.params.phaseToggle).toEqual({ exec: false, recog: false, total: true })
    expect(route.params.method).toBe('cfop')
    expect(route.params.driver).toBe('cube')
  })

  it('falls back totalToggle to total:true when all false', () => {
    const route = parseHash('#trends?ttotal=')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.totalToggle.total).toBe(true)
  })

  it('returns none for invalid method', () => {
    const route = parseHash('#trends?method=invalid')
    expect(route.type).toBe('trends')
    if (route.type !== 'trends') return
    expect(route.params.method).toBeNull()
  })

  it('returns none for empty hash', () => {
    expect(parseHash('')).toEqual({ type: 'none' })
  })

  it('returns none for unknown hash', () => {
    expect(parseHash('#unknown')).toEqual({ type: 'none' })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- tests/hooks/useHashRouter.test.ts
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/hooks/useHashRouter.test.ts
git commit -m "test: add parseHash unit tests"
```

---

## Task 3: Update `App.tsx`

**Files:**
- Modify: `src/App.tsx`

Changes:
- Import `useHashRouter` and `Route`
- Call `useHashRouter()` (remove existing `hashchange` listener)
- Initialize `mode` state from `currentRoute` and keep in sync via effect
- Pass `currentRoute` to `TimerScreen`
- Switch `window.location.hash =` to `history.replaceState` in the toggle handler

- [ ] **Step 1: Add import at the top of `App.tsx`**

After the existing imports, add:
```ts
import { useHashRouter } from './hooks/useHashRouter'
import type { Route } from './hooks/useHashRouter'
```

- [ ] **Step 2: Replace hashchange listener and mode initialization**

Remove these lines:
```ts
const [mode, setMode] = useState<'debug' | 'timer'>(() =>
  window.location.hash === '#debug' ? 'debug' : 'timer'
)
```
and the effect:
```ts
useEffect(() => {
  const handler = () => {
    setMode(window.location.hash === '#debug' ? 'debug' : 'timer')
  }
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}, [])
```

Replace with:
```ts
const { currentRoute } = useHashRouter()
const [mode, setMode] = useState<'debug' | 'timer'>(
  () => window.location.hash === '#debug' ? 'debug' : 'timer'
)
useEffect(() => {
  setMode(currentRoute.type === 'debug' ? 'debug' : 'timer')
}, [currentRoute])
```

- [ ] **Step 3: Switch toggle write-back to `replaceState`**

Find:
```ts
window.location.hash = next === 'debug' ? '#debug' : ''
```
Replace with:
```ts
history.replaceState(null, '', next === 'debug'
  ? `${window.location.pathname}${window.location.search}#debug`
  : window.location.pathname + window.location.search)
```

- [ ] **Step 4: Add `currentRoute` prop to `TimerScreen`**

Find the `<TimerScreen` JSX block in `App.tsx`. Add `currentRoute={currentRoute}` alongside the existing props:
```tsx
<TimerScreen
  driver={driver}
  status={status}
  facelets={facelets}
  quaternion={quaternion}
  onConnect={connect}
  onDisconnect={disconnect}
  onResetGyro={resetGyro}
  onResetState={resetAll}
  onResetCenters={resetCenterTracking}
  isSolvingRef={isSolvingRef}
  gestureResetRef={gestureResetRef}
  driverVersion={driverVersion}
  driverType={driverType}
  interactive={driverType === 'mouse'}
  onCubeMove={handleCubeMove}
  cloudConfig={cloudConfig}
  currentRoute={currentRoute}
/>
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```
Expected: TypeScript errors about missing `currentRoute` prop in `TimerScreen` (will be fixed in Task 4). All other errors should be zero.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire useHashRouter into App, pass currentRoute to TimerScreen"
```

---

## Task 4: Update `TimerScreen.tsx`

**Files:**
- Modify: `src/components/TimerScreen.tsx`

This is the largest change. Changes:
- Add `currentRoute: Route` to `Props` interface
- Remove `initialHashRef` and `hashchange` listener effect
- Remove `parseTrendsFilterFromHash` function (logic is now in `parseHash`)
- Update boot resolution effect to use `currentRoute`
- Update `selectedSolve` URL effect: `pushState` on open, context-aware `replaceState` on close
- Add `sharedSolve` URL effect: same pattern
- Update `useSharedSolve` call to pass `currentRoute`
- Update `detailOpen` prop to TrendsModal: include `!!sharedSolve || sharedSolveLoading`
- Update `TrendsModal` onClose to `replaceState` to base URL
- Update loading spinner label to use `currentRoute` instead of `initialHashRef`
- Pass `initialParams` to TrendsModal

- [ ] **Step 1: Add imports**

At the top of `src/components/TimerScreen.tsx`, add:
```ts
import { useHashRouter } from '../hooks/useHashRouter'
import type { Route, TrendsHashParams } from '../hooks/useHashRouter'
```

- [ ] **Step 2: Add `currentRoute` to Props and update function signature**

In the `Props` interface, add:
```ts
currentRoute: Route
```

In the `TimerScreen` function destructuring, add `currentRoute`:
```ts
export function TimerScreen({
  driver,
  facelets,
  quaternion,
  onResetGyro,
  onResetState,
  onResetCenters,
  isSolvingRef,
  gestureResetRef,
  driverVersion = 0,
  driverType,
  interactive,
  onCubeMove,
  cloudConfig,
  currentRoute,
}: Props) {
```

- [ ] **Step 3: Remove `parseTrendsFilterFromHash`**

Delete the entire `parseTrendsFilterFromHash` function (lines 50–61 currently):
```ts
function parseTrendsFilterFromHash(hash: string): Partial<SolveFilter> | null {
  ...
}
```

- [ ] **Step 4: Remove `initialHashRef` and add `prevSelectedSolveRef` + `prevSharedSolveRef`**

Remove:
```ts
const initialHashRef = useRef(window.location.hash)
```

Add (near `urlResolvedRef`):
```ts
const prevSelectedSolveRef = useRef<SolveRecord | null>(null)
const prevSharedSolveRef = useRef<SolveRecord | null>(null)
```

- [ ] **Step 5: Update boot resolution effect**

Replace the existing boot resolution effect:
```ts
// OLD — remove this entire effect:
useEffect(() => {
  if (cloudLoading || urlResolvedRef.current) return
  urlResolvedRef.current = true
  const hash = window.location.hash
  if (hash.startsWith('#trends')) {
    setShowTrends(true)
    const override = parseTrendsFilterFromHash(hash)
    if (override) updateSolveFilter(f => ({ ...f, ...override }))
  } else if (hash.startsWith('#solve-')) {
    const id = parseInt(hash.replace('#solve-', ''), 10)
    const solve = solves.find(s => s.id === id)
    if (solve) setSelectedSolve(solve)
  }
}, [cloudLoading, solves])
```

With:
```ts
useEffect(() => {
  if (cloudLoading || urlResolvedRef.current) return
  urlResolvedRef.current = true
  if (currentRoute.type === 'trends') {
    setShowTrends(true)
    const { method, driver } = currentRoute.params
    if (method || driver) {
      updateSolveFilter(f => ({
        ...f,
        ...(method ? { method } : {}),
        ...(driver ? { driver } : {}),
      }))
    }
  } else if (currentRoute.type === 'solve') {
    const solve = solves.find(s => s.id === currentRoute.id)
    if (solve) setSelectedSolve(solve)
  }
  // #shared is handled by useSharedSolve independently (no cloudLoading dependency)
}, [cloudLoading, solves, currentRoute])
```

- [ ] **Step 6: Remove hashchange listener effect**

Delete the entire effect:
```ts
// Remove this:
useEffect(() => {
  const handleHashChange = () => {
    const hash = window.location.hash
    if (hash.startsWith('#trends')) {
      setSelectedSolve(null)
      setShowTrends(true)
      const override = parseTrendsFilterFromHash(hash)
      if (override) updateSolveFilter(f => ({ ...f, ...override }))
    } else if (hash.startsWith('#solve-')) {
      const id = parseInt(hash.replace('#solve-', ''), 10)
      const solve = solves.find(s => s.id === id)
      if (solve) { setShowTrends(false); setSelectedSolve(solve) }
    } else {
      setSelectedSolve(null)
      setShowTrends(false)
    }
  }
  window.addEventListener('hashchange', handleHashChange)
  return () => window.removeEventListener('hashchange', handleHashChange)
}, [solves])
```

Add in its place a `currentRoute` reaction effect:
```ts
useEffect(() => {
  if (!urlResolvedRef.current) return
  if (currentRoute.type === 'trends') {
    setSelectedSolve(null)
    setShowTrends(true)
    const { method, driver } = currentRoute.params
    if (method || driver) {
      updateSolveFilter(f => ({
        ...f,
        ...(method ? { method } : {}),
        ...(driver ? { driver } : {}),
      }))
    }
  } else if (currentRoute.type === 'solve') {
    const solve = solves.find(s => s.id === currentRoute.id)
    if (solve) { setShowTrends(false); setSelectedSolve(solve) }
  } else if (currentRoute.type === 'none') {
    setSelectedSolve(null)
    setShowTrends(false)
  }
  // 'debug' and 'shared' handled by App.tsx and useSharedSolve respectively
}, [currentRoute, solves])
```

- [ ] **Step 7: Update `selectedSolve` URL write-back effect**

Replace the existing effect:
```ts
// OLD — remove:
useEffect(() => {
  if (!urlResolvedRef.current) return
  if (showTrends || !!sharedSolve || sharedSolveLoading) return
  if (selectedSolve) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#solve-${selectedSolve.id}`)
  } else {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}, [selectedSolve, showTrends, sharedSolve, sharedSolveLoading])
```

With:
```ts
useEffect(() => {
  if (!urlResolvedRef.current) return
  if (showTrends || !!sharedSolve || sharedSolveLoading) return
  const prev = prevSelectedSolveRef.current
  prevSelectedSolveRef.current = selectedSolve
  if (selectedSolve) {
    if (!prev) {
      // Opening: push new history entry
      history.pushState(null, '', `${window.location.pathname}${window.location.search}#solve-${selectedSolve.id}`)
    } else {
      // Switching solves: replace current entry
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#solve-${selectedSolve.id}`)
    }
  } else {
    // Closing: context-aware replaceState (showTrends case is guarded above — TrendsModal handles its own URL)
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}, [selectedSolve, showTrends, sharedSolve, sharedSolveLoading])
```

- [ ] **Step 8: Add `sharedSolve` URL write-back effect**

Add after the selectedSolve effect:
```ts
useEffect(() => {
  if (!urlResolvedRef.current) return
  if (showTrends) return
  const prev = prevSharedSolveRef.current
  prevSharedSolveRef.current = sharedSolve
  if (sharedSolve) {
    if (!prev) {
      history.pushState(null, '', `${window.location.pathname}${window.location.search}#shared-${sharedSolve.shareId!}`)
    }
  } else if (!sharedSolveLoading) {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}, [sharedSolve, sharedSolveLoading, showTrends])
```

- [ ] **Step 9: Update `useSharedSolve` call**

Change:
```ts
const { sharedSolve, sharedSolveLoading, sharedSolveNotFound, clearSharedSolve } = useSharedSolve()
```
To:
```ts
const { sharedSolve, sharedSolveLoading, sharedSolveNotFound, clearSharedSolve } = useSharedSolve(currentRoute)
```

- [ ] **Step 10: Add `defaultTrendsParams` constant and `trendParams` computed value**

Near the top of the component body (after state declarations), add:
```ts
const defaultTrendsParams: TrendsHashParams = {
  tab: 'total', windowSize: null, grouped: true,
  totalToggle: { exec: false, recog: false, total: true },
  phaseToggle: { exec: false, recog: false, total: true },
  method: null, driver: null,
}
const trendParams = currentRoute.type === 'trends' ? currentRoute.params : defaultTrendsParams
```

- [ ] **Step 11: Update TrendsModal JSX**

Find:
```tsx
{showTrends && (
  <TrendsModal
    solves={solves}
    solveFilter={solveFilter}
    updateSolveFilter={updateSolveFilter}
    onSelectSolve={setSelectedSolve}
    onClose={() => {
      setShowTrends(false)
      setSelectedSolve(null)
    }}
    detailOpen={!!selectedSolve}
  />
)}
```

Replace with:
```tsx
{showTrends && (
  <TrendsModal
    solves={solves}
    solveFilter={solveFilter}
    updateSolveFilter={updateSolveFilter}
    onSelectSolve={setSelectedSolve}
    onClose={() => {
      setShowTrends(false)
      setSelectedSolve(null)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }}
    detailOpen={!!selectedSolve || !!sharedSolve || sharedSolveLoading}
    initialParams={trendParams}
  />
)}
```

- [ ] **Step 12: Update loading spinner label**

Find (near the bottom of TimerScreen JSX):
```ts
{cloudLoading && !sharedSolveLoading && (() => {
  const h = initialHashRef.current
  const label = h.startsWith('#trends') ? 'Syncing trends from cloud…'
    : h.startsWith('#solve-') ? 'Syncing solve from cloud…'
```

Replace with:
```ts
{cloudLoading && !sharedSolveLoading && (() => {
  const label = currentRoute.type === 'trends' ? 'Syncing trends from cloud…'
    : currentRoute.type === 'solve' ? 'Syncing solve from cloud…'
```

- [ ] **Step 13: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```
Expected: TypeScript errors about `useSharedSolve` argument and `TrendsModal` `initialParams` prop (will be fixed in Tasks 5–6). Other errors should be zero.

- [ ] **Step 14: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: TimerScreen reads currentRoute prop, replaces raw hash reads"
```

---

## Task 5: Update `useSharedSolve.ts`

**Files:**
- Modify: `src/hooks/useSharedSolve.ts`

Changes:
- Accept `currentRoute: Route` as parameter
- Remove boot effect (initial hash read on mount)
- Remove hashchange listener effect
- Add effect reacting to `currentRoute.type === 'shared'`
- Remove `history.replaceState` from `doLoad` (race condition workaround no longer needed)
- Remove `history.replaceState` from `clearSharedSolve` (TimerScreen's effect handles URL clearing)

- [ ] **Step 1: Add import**

```ts
import type { Route } from './useHashRouter'
```

- [ ] **Step 2: Update function signature**

Change:
```ts
export function useSharedSolve(): UseSharedSolveResult {
```
To:
```ts
export function useSharedSolve(currentRoute: Route): UseSharedSolveResult {
```

- [ ] **Step 3: Remove `history.replaceState` from `doLoad`**

In `doLoad`, remove the line that restores the hash after a successful fetch:
```ts
// Remove this line from doLoad:
history.replaceState(null, '', `${window.location.pathname}${window.location.search}#shared-${shareId}`)
```

The updated `doLoad` `then` block becomes:
```ts
void Promise.race([loadSharedSolve(shareId).catch(() => null), timeout]).then((solve) => {
  setSharedSolveLoading(false)
  if (solve) {
    setSharedSolve(solve)
  } else {
    showNotFound()
  }
})
```

- [ ] **Step 4: Remove `history.replaceState` from `clearSharedSolve`**

Change:
```ts
const clearSharedSolve = useCallback(() => {
  setSharedSolve(null)
  history.replaceState(null, '', window.location.pathname + window.location.search)
}, [])
```
To:
```ts
const clearSharedSolve = useCallback(() => {
  setSharedSolve(null)
  // URL clearing is handled by TimerScreen's sharedSolve URL effect
}, [])
```

- [ ] **Step 5: Remove boot effect and hashchange listener, add `currentRoute` reaction**

Remove the boot effect:
```ts
// Remove:
useEffect(() => {
  const hash = window.location.hash
  if (!hash.startsWith('#shared-')) return
  const shareId = hash.replace('#shared-', '')
  doLoad(shareId, true)
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

Remove the hashchange listener effect:
```ts
// Remove:
useEffect(() => {
  const handler = () => {
    const hash = window.location.hash
    if (!hash.startsWith('#shared-')) return
    const shareId = hash.replace('#shared-', '')
    doLoad(shareId)
  }
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}, [doLoad])
```

Add in their place:
```ts
const isBootRef = useRef(true)

useEffect(() => {
  if (currentRoute.type !== 'shared') return
  const logAnalytics = isBootRef.current
  isBootRef.current = false
  doLoad(currentRoute.shareId, logAnalytics)
}, [currentRoute, doLoad])
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```
Expected: TypeScript errors about `TrendsModal` `initialParams` only (fixed in Task 6). Others zero.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSharedSolve.ts
git commit -m "feat: useSharedSolve reacts to currentRoute, removes own hashchange listener"
```

---

## Task 6: Update `TrendsModal.tsx`

**Files:**
- Modify: `src/components/TrendsModal.tsx`

Changes:
- Import `TrendsHashParams` from `useHashRouter`
- Add `initialParams: TrendsHashParams` to `Props`
- Remove `parseHashParams()` call on init, use `initialParams` instead
- Add `isFirstMountRef` to `pushState` on first render
- Switch URL sync effect from `window.location.hash =` to `replaceState`/`pushState`
- Add `detailOpen` guard in URL sync effect + add `detailOpen` to deps

- [ ] **Step 1: Add import**

```ts
import type { TrendsHashParams } from '../hooks/useHashRouter'
```

- [ ] **Step 2: Add `initialParams` to `Props`**

Find the `Props` type in `TrendsModal.tsx` (look for `onClose`, `detailOpen`). Add:
```ts
initialParams: TrendsHashParams
```

- [ ] **Step 3: Add `initialParams` to the function destructuring**

Find:
```ts
export function TrendsModal({ solves, solveFilter, updateSolveFilter, onSelectSolve, onClose, detailOpen }: Props) {
```
Replace with:
```ts
export function TrendsModal({ solves, solveFilter, updateSolveFilter, onSelectSolve, onClose, detailOpen, initialParams }: Props) {
```

- [ ] **Step 4: Replace `parseHashParams()` init with `initialParams`**

Remove:
```ts
const parsed = parseHashParams()
const [tab, setTab] = useState<Tab>(parsed.tab)
const [windowSize, setWindowSize] = useState<WindowSize>(parsed.windowSize ?? (isMobile ? 25 : 'all'))
const [grouped, setGrouped] = useState(parsed.grouped)
const [totalToggle, setTotalToggle] = useState<TimeToggle>({ exec: false, recog: false, total: true })
const [phaseToggle, setPhaseToggle] = useState<TimeToggle>(parsed.phaseToggle)
```

Replace with:
```ts
const [tab, setTab] = useState<Tab>(initialParams.tab)
const [windowSize, setWindowSize] = useState<WindowSize>(initialParams.windowSize ?? (isMobile ? 25 : 'all'))
const [grouped, setGrouped] = useState(initialParams.grouped)
const [totalToggle, setTotalToggle] = useState<TimeToggle>({ exec: false, recog: false, total: true })
const [phaseToggle, setPhaseToggle] = useState<TimeToggle>(initialParams.phaseToggle)
```

Note: `totalToggle` keeps its hardcoded default (preserving existing behavior where it is not restored from the URL).

- [ ] **Step 5: Add `isFirstMountRef`**

Add near the other `useRef` declarations:
```ts
const isFirstMountRef = useRef(true)
```

- [ ] **Step 6: Update URL sync effect**

Find:
```ts
useEffect(() => {
  const activeTotalTypes = (Object.keys(totalToggle) as TimeKey[]).filter(k => totalToggle[k]).join(',') || 'exec,recog,total'
  const activePhaseTypes = (Object.keys(phaseToggle) as TimeKey[]).filter(k => phaseToggle[k]).join(',') || 'total'
  const params = new URLSearchParams({
    method: solveFilter.method,
    driver: solveFilter.driver,
    tab,
    window: String(windowSize),
    group: grouped ? 'grouped' : 'split',
    ttotal: activeTotalTypes,
    tphase: activePhaseTypes,
  })
  window.location.hash = `trends?${params.toString()}`
}, [solveFilter.method, solveFilter.driver, tab, windowSize, grouped, totalToggle, phaseToggle])
```

Replace with:
```ts
useEffect(() => {
  if (detailOpen) return  // don't overwrite #solve or #shared URL while a detail modal is open
  const activeTotalTypes = (Object.keys(totalToggle) as TimeKey[]).filter(k => totalToggle[k]).join(',') || 'exec,recog,total'
  const activePhaseTypes = (Object.keys(phaseToggle) as TimeKey[]).filter(k => phaseToggle[k]).join(',') || 'total'
  const params = new URLSearchParams({
    method: solveFilter.method,
    driver: solveFilter.driver,
    tab,
    window: String(windowSize),
    group: grouped ? 'grouped' : 'split',
    ttotal: activeTotalTypes,
    tphase: activePhaseTypes,
  })
  const url = `${window.location.pathname}${window.location.search}#trends?${params.toString()}`
  if (isFirstMountRef.current) {
    history.pushState(null, '', url)
    isFirstMountRef.current = false
  } else {
    history.replaceState(null, '', url)
  }
}, [solveFilter.method, solveFilter.driver, tab, windowSize, grouped, totalToggle, phaseToggle, detailOpen])
```

- [ ] **Step 7: Remove `parseHashParams` function**

Delete the entire `parseHashParams` function (lines 102–125 currently). It is replaced by `parseTrendsParams` inside `useHashRouter`.

Also delete `parseToggle` if it's only used by `parseHashParams` — check first:
```bash
grep -n "parseToggle" src/components/TrendsModal.tsx
```
If only used by `parseHashParams`, delete it too.

- [ ] **Step 8: Verify full build and tests pass**

```bash
npm run build 2>&1 | tail -10
npm run test 2>&1 | tail -10
```
Expected: clean build, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/TrendsModal.tsx
git commit -m "feat: TrendsModal takes initialParams, switches to pushState/replaceState for URL sync"
```

---

## Task 7: Update `docs/url-routes.md`

**Files:**
- Modify: `docs/url-routes.md`

- [ ] **Step 1: Update the routing architecture section**

Replace the existing "Hash priority and conflict rules" section with:

```markdown
## Routing architecture

All hash routing is managed by `useHashRouter` (`src/hooks/useHashRouter.ts`), called once in `App.tsx`. It owns a single `hashchange` + `popstate` listener and parses the current hash into a typed `Route`:

```ts
type Route =
  | { type: 'debug' }
  | { type: 'solve'; id: number }
  | { type: 'shared'; shareId: string }
  | { type: 'trends'; params: TrendsHashParams }
  | { type: 'none' }
```

`currentRoute` is passed as a prop to `TimerScreen`, which distributes it further. Components react to `currentRoute` via `useEffect` — no component reads `window.location.hash` directly.

## URL write strategy

The router is read-only. Components write to the URL directly:

| Route | Method | Reason |
|---|---|---|
| `#solve-{id}` — opens | `pushState` | back button closes modal |
| `#shared-{shareId}` — opens | `pushState` | back button closes modal |
| `#trends` — opens | `pushState` | back button closes modal |
| `#trends?…` — param update | `replaceState` | state sync, not navigation |
| `#debug` toggle | `replaceState` | mode toggle, not navigation |
| any modal closes | `replaceState` | collapses history entry |

Both `hashchange` (typing a URL) and `popstate` (back/forward button) trigger the router.

## Boot resolution

On mount, `currentRoute` is initialized from the current hash immediately. `#solve` and `#trends` wait for `cloudLoading: false` before acting (data may be in Firestore). `#shared` and `#debug` do not wait.
```

- [ ] **Step 2: Update "Handled in" entries for each route**

Update each route's `**Handled in:**` line:

- `#debug` → `**Handled in:** App.tsx (reads currentRoute from useHashRouter)`
- `#solve-{id}` → `**Handled in:** TimerScreen.tsx (reads currentRoute prop)`
- `#shared-{shareId}` → `**Handled in:** useSharedSolve.ts (reads currentRoute param)`
- `#trends?{params}` → `**Handled in:** TimerScreen.tsx + TrendsModal.tsx (TimerScreen reads currentRoute; TrendsModal manages params state and URL sync)`

- [ ] **Step 3: Verify build and tests still pass**

```bash
npm run build 2>&1 | tail -5
npm run test 2>&1 | tail -5
```
Expected: clean build, all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add docs/url-routes.md
git commit -m "docs: update url-routes.md to reflect useHashRouter architecture"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Single `hashchange` + `popstate` listener in `useHashRouter` — Task 1
- ✅ `Route` discriminated union with all 4 types + `none` — Task 1
- ✅ `parseHash` as pure function with invalid-input handling — Tasks 1–2
- ✅ Called once in `App.tsx`, prop passed to `TimerScreen` — Tasks 3–4
- ✅ `App.tsx` removes its own listener, reads `currentRoute.type === 'debug'` — Task 3
- ✅ `TimerScreen` removes its listener, boot resolution uses `currentRoute` — Task 4
- ✅ `useSharedSolve` removes its listener, reacts to `currentRoute` — Task 5
- ✅ `TrendsModal` removes `parseHashParams()` init, switches to `replaceState`/`pushState` — Task 6
- ✅ `pushState` on open for solve, shared, trends — Tasks 4, 5, 6
- ✅ `replaceState` for param updates, debug, close — Tasks 3, 4, 6
- ✅ `detailOpen` guard in TrendsModal URL effect — Task 6
- ✅ Context-aware close (Escape restores trends URL via TrendsModal effect) — Tasks 4, 6
- ✅ Boot resolution waits for cloudLoading for solve + trends, not shared — Task 4
- ✅ `docs/url-routes.md` updated — Task 7

**No placeholders found.**

**Type consistency:** `TrendsHashParams` defined in Task 1, imported in Tasks 4 and 6. `Route` defined in Task 1, imported in Tasks 3, 4, 5. All consistent.
