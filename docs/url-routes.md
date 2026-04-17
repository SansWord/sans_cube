# URL Routes

All routing in sans_cube is hash-based. There are no path-based routes — the app is a single-page app served from one URL. The hash encodes which view to open and any associated state.

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

## Supported hashes

### `#debug`

Opens the app directly in debug mode (replaces the timer screen with diagnostic tools).

- Toggling the `[debug]` / `[timer]` button in the connection bar updates the hash to match.
- Toggling back to timer clears the hash.
- **Handled in:** `App.tsx` (reads `currentRoute` from `useHashRouter`)

---

### `#solve-{id}`

Opens the solve detail modal for the solve with the given numeric `id`.

- Written via `history.pushState` when a solve is selected (supports back button to close).
- Cleared via `history.replaceState` when the modal is closed.
- On boot, resolved after cloud data finishes loading to handle the case where the solve lives in Firestore.
- **Handled in:** `TimerScreen.tsx` (reads `currentRoute` prop)

**Example:** `#solve-42`

---

### `#shared-{shareId}`

Loads a publicly shared solve from Firestore and opens it in the solve detail modal.

- `shareId` is the Firestore document ID in the `public_solves` collection.
- Valid format enforced by `SHARE_ID_RE` in `firestoreSharing.ts`.
- Shows a loading state while fetching; shows a "not found" message (3 s) if the fetch fails or times out.
- Does not wait for `cloudLoading` — fetches a public document, no user auth needed.
- **Handled in:** `useSharedSolve.ts` (reads `currentRoute` param)

**Example:** `#shared-abc123xyz`

---

### `#trends?{params}`

Opens the TrendsModal with the given view state. All params are optional; missing params fall back to defaults.

| Param | Values | Description |
|-------|--------|-------------|
| `method` | `all` \| `cfop` \| `roux` | Method filter |
| `driver` | `all` \| `cube` \| `mouse` | Driver filter |
| `tab` | `total` \| `phases` | Active chart tab |
| `window` | `25` \| `50` \| `100` \| `all` | Rolling average window size |
| `group` | `grouped` \| `split` | Phase grouping toggle |
| `ttotal` | comma-separated: `exec`, `recog`, `total` | Time types shown on total tab |
| `tphase` | comma-separated: `exec`, `recog`, `total` | Time types shown on phases tab |

- `pushState` on first open; `replaceState` for subsequent param updates (no history accumulation on filter changes).
- `detailOpen` guard prevents TrendsModal from overwriting `#solve` or `#shared` URL while a detail modal is open.
- **Handled in:** `TimerScreen.tsx` + `TrendsModal.tsx` (TimerScreen reads `currentRoute`; TrendsModal manages params state and URL sync)

**Example:** `#trends?method=cfop&driver=cube&tab=total&window=50&group=grouped&ttotal=total&tphase=total`

---

## When to update this document

Update `docs/url-routes.md` whenever you:
- Add a new hash-based route
- Change the params of an existing route
- Change which file handles a route
