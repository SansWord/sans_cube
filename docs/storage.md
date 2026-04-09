# Storage Reference

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `sans_cube_solves` | `SolveRecord[]` (JSON) | Solve history in local mode. Not used when cloud sync is enabled. |
| `sans_cube_next_id` | `number` | The next seq/id to assign to a new solve. Updated on every new solve and synced from Firestore counter on page load (cloud mode). |
| `sans_cube_dismissed_examples` | `number[]` (JSON) | IDs of example solves the user has dismissed. |
| `cubeOrientationConfig` | `{ front: string, bottom: string }` (JSON) | Front and bottom face color config for cube orientation. |
| `sidebarWidth` | `number` | Width of the solve history sidebar in pixels. |
| `sans_cube_method` | `string` | Selected solve method (`'cfop'` or `'roux'`). |
| `sans_cube_cloud_sync_enabled` | `boolean` (JSON) | Whether cloud sync is enabled. Auth state is managed by Firebase SDK separately. |

---

## Firestore Structure

```
users/{uid}/
  solves/{date}/          — one document per solve, keyed by Date.now() at solve time
  meta/
    counter               — tracks next seq number
```

### `users/{uid}/solves/{date}`

Stores a full `SolveRecord`. Key fields relevant to storage:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | `Date.now()` at solve time (cloud mode). Same as the document key. |
| `seq` | `number` | Display number (1-indexed, gaps allowed on delete). Assigned from `sans_cube_next_id` counter. |
| `date` | `number` | Unix timestamp (`Date.now()`). Used for ordering. |
| `scramble` | `string` | Scramble sequence. |
| `timeMs` | `number` | Wall-clock solve duration in ms. |
| `moves` | `Move[]` | All moves with timestamps, used for replay. |
| `phases` | `PhaseRecord[]` | CFOP/Roux phase breakdown. |
| `method` | `string?` | `'cfop'` or `'roux'`. Absent on old solves, treated as `'cfop'`. |
| `driver` | `string?` | `'cube'` or `'mouse'`. |

### `users/{uid}/meta/counter`

| Field | Type | Description |
|-------|------|-------------|
| `nextSeq` | `number` | The next seq value to assign. Only ever increments — deletions do not lower it. Written on every new solve and after a renumber operation. |

---

## What Syncs from Firestore vs. localStorage Only

| Data | localStorage | Firestore | Notes |
|------|-------------|-----------|-------|
| Solve records | `sans_cube_solves` | `solves/{date}` | Mutually exclusive: local mode uses localStorage, cloud mode uses Firestore. Migration copies local → Firestore on first cloud enable. |
| Next seq counter | `sans_cube_next_id` | `meta/counter.nextSeq` | localStorage is the working copy. On page load (cloud mode), Firestore value wins if higher. Written to both on every new solve. |
| Dismissed examples | `sans_cube_dismissed_examples` | — | localStorage only. Not synced. |
| Orientation config | `cubeOrientationConfig` | — | localStorage only. Not synced. |
| Sidebar width | `sidebarWidth` | — | localStorage only. Not synced. |
| Solve method | `sans_cube_method` | — | localStorage only. Not synced. |
| Cloud sync enabled | `sans_cube_cloud_sync_enabled` | — | localStorage only. Firebase Auth session is managed by the Firebase SDK independently. |

### Sync rules for the seq counter

- **On page load (cloud mode):** `loadNextSeqFromFirestore` and `loadSolvesFromFirestore` run in parallel. If `counter.nextSeq > localStorage NEXT_ID`, localStorage is updated to match.
- **On new solve (cloud mode):** `addSolveToFirestore` and `updateCounterInFirestore` fire in parallel (fire-and-forget). localStorage `NEXT_ID` is updated synchronously before either write.
- **After renumber:** `renumberSolvesInFirestore` updates both all solve docs and `meta/counter` in a single `Promise.all`.
