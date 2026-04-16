# Storage Reference

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `sans_cube_solves` | `SolveRecord[]` (JSON) | Solve history in local mode. Not used when cloud sync is enabled. |
| `sans_cube_next_id` | `number` | The next seq/id to assign to a new solve. Updated on every new solve and synced from Firestore counter on page load (cloud mode). |
| `sans_cube_dismissed_examples` | `number[]` (JSON) | IDs of example solves the user has dismissed. |
| `cubeOrientationConfig` | `{ front: string, bottom: string }` (JSON) | Front and bottom face color config for cube orientation. |
| `sidebarWidth` | `number` | Width of the solve history sidebar in pixels. |
| `sans_cube_method` | `string` | Active recording method (`'cfop'` or `'roux'`). Controls what method tags the next solve. |
| `sans_cube_method_filter` | `string` | Method display filter (`'all'`, `'cfop'`, or `'roux'`). Affects sidebar stats and Trends chart. |
| `sans_cube_driver_filter` | `string` | Driver display filter (`'all'`, `'cube'`, or `'mouse'`). Affects sidebar stats and Trends chart. |
| `sans_cube_cloud_sync_enabled` | `boolean` (JSON) | Whether cloud sync is enabled. Auth state is managed by Firebase SDK separately. |
| `sans_cube_analytics_acknowledged` | `"true"` | Set when user dismisses the analytics consent banner |
| `sans_cube_mac_address` | `string` | Cube's Bluetooth MAC address, saved after first manual entry on macOS where the OS hides the real MAC from Web Bluetooth |

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
| `schemaVersion` | `number?` | `1` = v1 (fixed GAN face map, M/E/S labels may be wrong after center drift). `2` = v2 (center-tracking, correct labels). Absent = v1. |
| `moves` | `Move[]` | All moves with timestamps, used for replay. In v2, face labels are geometrically correct even after M/E/S center drift. |
| `movesV1` | `Move[]?` | Original pre-migration moves. Present only on Firestore-migrated records awaiting user review. Absent on localStorage and new records (stripped before save). |
| `migrationNote` | `string?` | Per-phase diff summary when v1→v2 migration changed phase boundaries (labels, turns, timing). Stored for user review; cleared via "Mark reviewed" in SolveDetailModal. Absent when phases matched exactly or for fast-path migrations. |
| `phases` | `PhaseRecord[]` | CFOP/Roux phase breakdown. |
| `method` | `string?` | `'cfop'` or `'roux'`. Absent on old solves, treated as `'cfop'`. |
| `driver` | `string?` | `'cube'` or `'mouse'`. |

### `users/{uid}/meta/counter`

| Field | Type | Description |
|-------|------|-------------|
| `nextSeq` | `number` | The next seq value to assign. Only ever increments — deletions do not lower it. Written on every new solve and after a renumber operation. |

### `public_solves/{shareId}`

Publicly readable solve snapshot. Created when an owner shares a solve.

| Field | Type | Description |
|-------|------|-------------|
| `solve` | `SolveRecord` | Full solve snapshot at time of last share/update |

### `users/{uid}/shared_solves/{shareId}`

Private ownership registry. Empty document — its existence proves the authenticated user owns the share.

| Field | Type | Description |
|-------|------|-------------|
| *(empty)* | — | Presence is the ownership signal |

---

## What Syncs from Firestore vs. localStorage Only

| Data | localStorage | Firestore | Notes |
|------|-------------|-----------|-------|
| Solve records | `sans_cube_solves` | `solves/{date}` | Mutually exclusive: local mode uses localStorage, cloud mode uses Firestore. Migration copies local → Firestore on first cloud enable. |
| Next seq counter | `sans_cube_next_id` | `meta/counter.nextSeq` | localStorage is the working copy. On page load (cloud mode), Firestore value wins if higher. Written to both on every new solve. |
| Shared solve snapshot | — | `public_solves/{shareId}` | Written on share, updated on solve update, deleted on unshare |
| Share ownership registry | — | `users/{uid}/shared_solves/{shareId}` | Private; presence proves ownership for Firestore rules |
| Dismissed examples | `sans_cube_dismissed_examples` | — | localStorage only. Not synced. |
| Orientation config | `cubeOrientationConfig` | — | localStorage only. Not synced. |
| Sidebar width | `sidebarWidth` | — | localStorage only. Not synced. |
| Active recording method | `sans_cube_method` | — | localStorage only. Not synced. |
| Method display filter | `sans_cube_method_filter` | — | localStorage only. Not synced. |
| Driver display filter | `sans_cube_driver_filter` | — | localStorage only. Not synced. |
| Cloud sync enabled | `sans_cube_cloud_sync_enabled` | — | localStorage only. Firebase Auth session is managed by the Firebase SDK independently. |
| Cube MAC address | `sans_cube_mac_address` | — | localStorage only. Not synced. Only needed on macOS. |

### Sync rules for the seq counter

- **On page load (cloud mode):** `loadNextSeqFromFirestore` and `loadSolvesFromFirestore` run in parallel. If `counter.nextSeq > localStorage NEXT_ID`, localStorage is updated to match.
- **On new solve (cloud mode):** `addSolveToFirestore` and `updateCounterInFirestore` fire in parallel (fire-and-forget). localStorage `NEXT_ID` is updated synchronously before either write.
- **After renumber:** `renumberSolvesInFirestore` updates both all solve docs and `meta/counter` in a single `Promise.all`.
