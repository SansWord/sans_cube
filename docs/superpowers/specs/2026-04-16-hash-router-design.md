# Hash Router Design

**Date:** 2026-04-16  
**Status:** Ready for implementation

## Problem

The app has 3 independent `hashchange` listeners spread across `App.tsx`, `TimerScreen.tsx`, and `useSharedSolve.ts`. Each reads `window.location.hash` independently and decides whether to act. Conflict rules and priority ordering exist only in comments. A race condition in `useSharedSolve` (where `TimerScreen`'s URL-sync effect could clear the hash mid-fetch) was patched with a workaround comment.

## Goal

Consolidate all hash routing into a single `useHashRouter` hook. One listener, one parser, typed route state that flows to components as props.

---

## Architecture

`useHashRouter` is called **once in `App.tsx`**. It owns the single `hashchange` + `popstate` listener, parses the hash into a typed `Route`, and exposes `currentRoute` as React state. `App.tsx` passes `currentRoute` down to `TimerScreen` as a prop. `useSharedSolve` receives it as a parameter.

The hook is **read-only** — it never writes to the URL. Write-back (URL ↔ UI sync) stays in the components.

---

## Route Type

```ts
export type Route =
  | { type: 'debug' }
  | { type: 'solve'; id: number }
  | { type: 'shared'; shareId: string }
  | { type: 'trends'; params: TrendsHashParams }
  | { type: 'none' }
```

`parseHash(hash: string): Route` is a pure function. Invalid or unknown hashes return `{ type: 'none' }`. Invalid numeric IDs (e.g. `#solve-abc`) return `{ type: 'none' }`.

`TrendsHashParams` is the existing parsed params shape from `TrendsModal` — moved to `useHashRouter` so it can be shared.

---

## `useHashRouter` Hook

```ts
export function useHashRouter(): { currentRoute: Route } {
  const [currentRoute, setCurrentRoute] = useState<Route>(
    () => parseHash(window.location.hash)
  )

  useEffect(() => {
    const handler = () => setCurrentRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', handler)
    window.addEventListener('popstate', handler)   // needed for back/forward
    return () => {
      window.removeEventListener('hashchange', handler)
      window.removeEventListener('popstate', handler)
    }
  }, [])

  return { currentRoute }
}
```

Both `hashchange` and `popstate` run the same handler — re-parse `window.location.hash`. No loop risk: `replaceState` and `pushState` do not fire either event.

---

## URL Write Strategy

Components write to the URL directly. The router never writes.

| Situation | Method | Reason |
|---|---|---|
| `#solve-{id}` — modal opens | `pushState` | back button closes modal |
| `#shared-{shareId}` — modal opens | `pushState` | back button closes modal |
| `#trends` — modal opens | `pushState` | back button closes modal |
| `#trends?...` — param update | `replaceState` | state sync, not navigation |
| `#debug` toggle | `replaceState` | mode toggle, not navigation |
| any modal closes | `replaceState` | collapses history entry |
| clear URL (base) | `replaceState` | always |

### Close behavior

When a modal closes via Escape or close button, `replaceState` is used (not `history.back()`). The destination is context-aware:

- If `showTrends` is true behind the solve modal → `replaceState` to `#trends?{currentParams}`
- Otherwise → `replaceState` to base URL (no hash)

Back button is pure native behavior — `popstate` fires, router re-parses, components react. Can go back to trends, base URL, or out of the app entirely if that was the first visited URL.

### No-loop guarantee

- `pushState` / `replaceState` do not fire `hashchange` or `popstate` — write-backs never re-trigger the router.
- `#debug` toggle uses `replaceState` so the hash stays stable across re-renders.
- `#trends` param updates use `replaceState` — no history stack accumulation on filter changes.

---

## Boot Resolution

On mount, `currentRoute` is initialized from the current hash immediately. However, `#solve`, `#shared`, and `#trends` all depend on solve data being loaded (Firestore may not have returned yet). `#debug` does not depend on data.

The boot resolution effect in `TimerScreen` fires once when `cloudLoading` becomes `false`, then acts on `currentRoute`:

- `type: 'solve'` → find solve in loaded list, open modal
- `type: 'shared'` → trigger `useSharedSolve` load
- `type: 'trends'` → open trends modal with parsed params
- `type: 'debug'` → already handled by `App.tsx` immediately
- `type: 'none'` → no-op

---

## Component Changes

### `src/hooks/useHashRouter.ts` (new file)
- `Route` discriminated union type
- `TrendsHashParams` type (moved from `TrendsModal`)
- `parseHash(hash: string): Route` pure function
- `useHashRouter()` hook

### `App.tsx`
- Call `useHashRouter()` — the only call site
- Remove existing `hashchange` listener
- Read `currentRoute.type === 'debug'` instead of `window.location.hash === '#debug'`
- Pass `currentRoute` to `TimerScreen` as a prop

### `TimerScreen.tsx`
- Accept `currentRoute: Route` as a prop
- Remove `hashchange` listener
- Remove raw `window.location.hash` reads
- Boot resolution effect guards `#solve`, `#shared`, `#trends` behind `cloudLoading`
- `useEffect` reacts to `currentRoute` for each route type
- `#solve` open: `pushState` (was `replaceState`)
- `#trends` open: `pushState` (was `window.location.hash =`)
- `#trends` param updates: `replaceState` (was `window.location.hash =`)
- Solve modal close: `replaceState` to `#trends?...` if trends is open, else base URL

### `useSharedSolve.ts`
- Accept `currentRoute: Route` as a parameter
- Remove `hashchange` listener
- Remove boot-time hash read
- React to `currentRoute.type === 'shared'` via `useEffect`
- `#shared` open: `pushState` (was `replaceState`)
- Close: `replaceState` to `#trends?...` if trends is open, else base URL (same context-aware logic as solve close)

### `TrendsModal.tsx`
- Remove `parseHashParams()` call on init — initial params come from `currentRoute.params` passed in by `TimerScreen`
- Switch `window.location.hash =` → `replaceState` for param updates
- No listener changes (it never had one)

---

## Testing

- `parseHash` is a pure function — unit test all route patterns:
  - Valid: `#debug`, `#solve-42`, `#shared-abc123`, `#trends?method=cfop`
  - Invalid: `#solve-abc`, `#unknown`, empty string → all return `{ type: 'none' }`
- Component behavior (modal opens/closes on route change) covered by existing integration tests

---

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useHashRouter.ts` | New |
| `src/App.tsx` | Remove listener, read route, pass prop |
| `src/components/TimerScreen.tsx` | Accept prop, remove listener, update write-backs |
| `src/hooks/useSharedSolve.ts` | Accept param, remove listener, update write-back |
| `src/components/TrendsModal.tsx` | Remove init parse, switch to replaceState |
| `docs/url-routes.md` | Update to reflect new routing architecture |
