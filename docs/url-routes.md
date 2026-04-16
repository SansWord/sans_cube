# URL Routes

All routing in sans_cube is hash-based. There are no path-based routes — the app is a single-page app served from one URL. The hash encodes which view to open and any associated state.

## Supported hashes

### `#debug`

Opens the app directly in debug mode (replaces the timer screen with diagnostic tools).

- Toggling the `[debug]` / `[timer]` button in the connection bar updates the hash to match.
- Toggling back to timer clears the hash.
- **Handled in:** `App.tsx`

---

### `#solve-{id}`

Opens the solve detail modal for the solve with the given numeric `id`.

- Written via `history.replaceState` (no hashchange event) when a solve is selected.
- Cleared when the modal is closed.
- On boot, resolved after cloud data finishes loading to handle the case where the solve lives in Firestore.
- **Handled in:** `TimerScreen.tsx`

**Example:** `#solve-42`

---

### `#shared-{shareId}`

Loads a publicly shared solve from Firestore and opens it in the solve detail modal.

- `shareId` is the Firestore document ID in the `public_solves` collection.
- Valid format enforced by `SHARE_ID_RE` in `firestoreSharing.ts`.
- Shows a loading state while fetching; shows a "not found" message (3 s) if the fetch fails or times out.
- Cleared from the URL when the modal is closed.
- **Handled in:** `useSharedSolve.ts`

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

- Hash is written via `window.location.hash =` (fires hashchange) whenever any TrendsModal state changes.
- Cleared when TrendsModal closes.
- **Handled in:** `TrendsModal.tsx` (`parseHashParams`, sync effect)

**Example:** `#trends?method=cfop&driver=cube&tab=total&window=50&group=grouped&ttotal=total&tphase=total`

---

## Hash priority and conflict rules

- Hashes are checked in mount order: `useSharedSolve` (boot only) → `TimerScreen` initial resolution → `hashchange` listeners.
- `#debug` is handled before any `TimerScreen` code runs (in `App.tsx`), so it never reaches `TimerScreen`'s resolver.
- Unknown hashes fall through to `TimerScreen`'s `else` branch, which closes any open modal — benign.
- `TimerScreen` uses `history.replaceState` (not `window.location.hash =`) when writing `#solve-{id}` to avoid triggering its own `hashchange` listener.

## When to update this document

Update `docs/url-routes.md` whenever you:
- Add a new hash-based route
- Change the params of an existing route
- Change which file handles a route
