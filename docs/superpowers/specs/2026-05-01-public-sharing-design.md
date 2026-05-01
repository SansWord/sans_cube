# Public Sharing Without Cloud Sync — Design

**Date:** 2026-05-01
**Status:** Ready for plan
**Target version:** v1.31.0

## Goal

Currently the Share button in `SolveDetailModal` only appears for users who have enabled cloud sync **and** signed in with Google (gated in `TimerScreen.tsx:522-529`). Make sharing available to **any** user — including those who have never signed in or enabled cloud sync — so a solver can post a public share URL with the lowest possible friction.

The design priority is **friction first** (one click, no popup, no extra UI) and **privacy second**.

## Approach: Anonymous Firebase Auth on Demand

When a not-signed-in user clicks Share, the app silently calls `signInAnonymously()` to obtain a uid, then runs the existing share flow. The anonymous session persists in Firebase's IndexedDB across reloads in the same browser.

### Why this approach

- Existing Firestore security rules require `request.auth.uid` to write the registry doc at `users/{uid}/shared_solves/{shareId}`. Anonymous auth supplies a uid without forcing the user to sign in.
- Keeps the existing security model intact — no rule loosening, no new exposure surface.
- Unshare still works **from the same browser** because the anon uid is stable in IndexedDB.
- Single click to share. No popup, no consent UI, no required account creation.

### Approach trade-offs accepted

- **Per-browser unshare only.** Same browser → same anon uid → Unshare works. Different browser, different device, or incognito → fresh uid → can't unshare from there. Acceptable for the share-link use case ("post and forget"). The public share URL still works everywhere.
- **Clearing site data orphans the share.** Both the IndexedDB anon session and the localStorage solve disappear together — the share URL still resolves on Firestore, but the user can't unshare it from any browser. Coherent failure mode (both gone, no zombie state in the UI).
- **Stay signed in (don't auto-sign-out after upload).** Signing out destroys the anon uid forever — Firebase doesn't allow "logging back in" to an anonymous account. So Unshare would break. Worth the invisible session.

### Approaches considered and rejected

- **Relax Firestore rules to allow unauthenticated writes.** Zero friction, but either kills Unshare entirely or requires a Cloud Function (Blaze tier). Loses the unauth-write abuse safety. Rejected.
- **Capability URL with owner-held secret token.** Unshare-from-anywhere works because the secret is in the URL. Adds cognitive friction ("don't lose this URL") that defeats the friction-first priority. Rejected.

### Decisions explicitly NOT made (deferred to `future.md`)

- **Anon → Google account merging.** If an anon user later signs in with Google, that's a *third* uid; previous anon shares stay owned by the anon uid. Tracked in `future.md` under `## firebase`.
- **Detect un-unshare-able shares and hide the Unshare button.** v1.31.0 ships with a simple gate: Unshare is shown whenever any user is signed in. Two cases will fail if the user clicks: (a) shared while anonymous, then site data cleared — fails with the client-side `throw new Error('not signed in')` before any Firestore call; (b) shared while anonymous, then signed in with Google — fails with a Firestore rule rejection because the Google uid does not own the registry doc. The fix would be to stamp `shareOwnerUid` on the local `SolveRecord` at share time and gate the button on `cloudConfig.user.uid === solve.shareOwnerUid`. Tracked in `future.md` under `## firebase`. v1.31.0 surfaces the existing share-error toast for both cases instead.
- **App-side rate limiting.** Threat model on Spark tier = availability not cost; quota auto-rejects abusive load. Revisit if abuse shows up in practice.
- **No new localStorage keys.** Firebase persists the anon session itself in IndexedDB (`firebaseLocalStorageDb`); `solve.shareId` already lives on the `SolveRecord`. Nothing extra to store.

## Architecture

### Two distinct user states after this change

| State | `cloudSync.user` | `cloudSync.user.isAnonymous` | Cloud sync of *solves* | Can share |
|---|---|---|---|---|
| Not signed in | `null` | n/a | No | Yes (provisions anon on click) |
| Anonymous (post-share) | non-null | `true` | No (forced off) | Yes |
| Google signed-in | non-null | `false` | Yes if enabled | Yes |

Anonymous users are treated as "not signed in" for cloud-sync-of-solves purposes. Their solves still write to localStorage. The cloud-sync UI still says "Sign in with Google." Only the share/unshare flow uses the anon uid.

Firestore rules are unchanged — anon users have a real uid, so the existing `exists(/databases/$(database)/documents/users/$(request.auth.uid)/shared_solves/$(shareId))` check still works.

## Code Changes

### `src/hooks/useCloudSync.ts`

- Import `signInAnonymously as fbSignInAnonymously` from `firebase/auth`.
- In the `onAuthStateChanged` callback: if `u` is null **or** `u.isAnonymous`, force `enabled = false` and clear `STORAGE_KEYS.CLOUD_SYNC_ENABLED` in localStorage. Treat anon as "not signed in" for cloud-sync semantics.
- **Leave `setAnalyticsUser(u ? u.uid : null)` unchanged** — anon uid still flows to Analytics so we capture tiny anon sessions, retention, and funnels for anon sharers.
- Expose a new method on the returned `CloudSyncState`:
  ```ts
  signInAnonymously: () => Promise<User>
  ```
  Implementation: `const cred = await fbSignInAnonymously(auth); return cred.user`.
- The raw `user` field still surfaces the anon user (callers need the uid to share). Consumers that want a *real* sign-in gate on `user && !user.isAnonymous`.

### `src/stores/solveStore.ts` — `CloudConfig`

Add `signInAnonymously` so `TimerScreen` can call it via `cloudConfig`:

```ts
export interface CloudConfig {
  enabled: boolean
  user: User | null
  authLoading?: boolean
  signInAnonymously: () => Promise<User>   // NEW
}
```

`solveStore`'s internal cloud-vs-local decision (`config.enabled && config.user`) is unchanged. Anon users have `enabled === false` → still local-only. No new branch in `configKey`.

### `src/App.tsx`

- The `cloudConfig` object built around line 60 now includes `signInAnonymously: cloudSync.signInAnonymously`.
- `useCloudNow` at line 115: change to `!!(cloudSync.enabled && cloudSync.user && !cloudSync.user.isAnonymous)`. Defensive — `enabled` is already forced false for anon, but the explicit check guards against any stale render.
- Cloud-sync debug panel (line 271-350): change the branch condition from `cloudSync.user` to `cloudSync.user && !cloudSync.user.isAnonymous`. Anon users fall into the existing "Not signed in / Sign in with Google" branch (otherwise the panel would render "Signed in as undefined").

### `src/components/TimerScreen.tsx` (line 522-529)

Drop the `cloudConfig?.enabled && cloudConfig?.user` gate. Make `onShare` available unconditionally for the user's own solves; provision an anon session if needed:

```tsx
onShare={async (solve) => {
  let uid = cloudConfig?.user?.uid
  if (!uid) {
    if (!cloudConfig?.signInAnonymously) throw new Error('cloud config unavailable')
    const anon = await cloudConfig.signInAnonymously()
    uid = anon.uid
  }
  return shareSolve(uid, solve)
}}
onUnshare={async (shareId) => {
  if (!cloudConfig?.user) throw new Error('not signed in')
  await unshareSolve(cloudConfig.user.uid, shareId)
}}
```

The `onUnshare` for the **shared-solve preview** path (line 539-542) keeps the `sharedSolveIsOwned && cloudConfig?.user` gate — viewing a shared URL only shows Unshare if the current user owns it (existing behavior).

### `src/components/SolveDetailModal.tsx`

**No changes.** The Share row already shows whenever `onShare` is provided (`SolveDetailModal.tsx:766`). It is agnostic to cloud-sync state.

### `src/services/firestoreSharing.ts`

**No changes.** `shareSolve(uid, solve)` and `unshareSolve(uid, shareId)` are uid-agnostic.

### `firestore.rules`

**No changes.** Anon users have a real uid; the existing `exists()` check on the registry doc still works. (Local file does not exist in this repo; rules live in Firebase Console — confirm deployed rule before merge.)

## Data Flow

### Share click — full sequence

```
User clicks "Share" on an owned solve
   │
   ▼
TimerScreen onShare(solve)
   │
   ├─ uid = cloudConfig.user?.uid
   │   │
   │   ├─ if uid is null → cloudConfig.signInAnonymously()
   │   │     │
   │   │     ├─ Firebase creates anon session, persists in IndexedDB
   │   │     ├─ onAuthStateChanged fires → useCloudSync sets user (anon)
   │   │     │   and forces enabled = false
   │   │     │   App.tsx re-renders with cloudConfig.user = anon user
   │   │     └─ returns User → uid = anon.uid
   │   │
   │   └─ uid is now defined
   │
   ▼
shareSolve(uid, solve)         (existing path, unchanged)
   ├─ generate shareId
   ├─ write users/{uid}/shared_solves/{shareId} = {}
   ├─ write public_solves/{shareId} = { solve }
   └─ updateSolve(solve with shareId set)   ← stamps localStorage record
```

The "stamp shareId on the local solve" step: since anon users have `enabled = false`, `solveStore`'s update path writes to localStorage only — same as today's not-signed-in path. The `shareId` field rides along on the localStorage record.

### Unshare click — full sequence

```
User clicks "Unshare"
   │
   ▼
TimerScreen onUnshare(shareId)
   │
   ├─ if !cloudConfig.user → throw "not signed in"
   │   (e.g. anon session was cleared but solve.shareId still on localStorage)
   │
   ▼
unshareSolve(uid, shareId)     (existing path, unchanged)
   ├─ delete public_solves/{shareId}
   ├─ delete users/{uid}/shared_solves/{shareId}
   └─ updateSolve(solve with shareId cleared)
```

### State table — what `SolveDetailModal` shows

| Auth state | `solve.shareId` set | Modal shows |
|---|---|---|
| Not signed in | no | Share button (will trigger anon auth) |
| Not signed in | yes (orphaned) | Unshare button → click throws "not signed in" → error toast |
| Anonymous | no | Share button (uses existing anon uid) |
| Anonymous | yes | Unshare button → works (same anon uid owns it) |
| Google | no | Share button |
| Google | yes | Unshare button |

The "orphaned" row is the only new failure path. The fix to hide the button cleanly is tracked in `future.md`; v1.31.0 surfaces the existing error toast.

### Cloud-sync debug panel state transitions

| `cloudSync.user` | `isAnonymous` | Panel shows |
|---|---|---|
| null | n/a | "Not signed in" + Sign in with Google button (unchanged) |
| non-null | true | "Not signed in" + Sign in with Google button **(NEW — would have shown "Signed in as undefined" before fix)** |
| non-null | false | "Signed in as {email}" + cloud-sync controls (unchanged) |

## Error Handling

| Failure | Handler | UX |
|---|---|---|
| `signInAnonymously()` fails (network/Firebase outage) | `onShare` rejects → existing share-button error path in `SolveDetailModal` | Existing share error state |
| `shareSolve` write fails after anon auth succeeded | Same as today's signed-in failure path | Existing error state |
| Anon session present but `unshareSolve` rule-rejected (anon→Google or anon-cleared footgun) | `onUnshare` rejects → existing unshare error path | Existing error state (will be silenced by future-work item) |
| `cloudConfig.signInAnonymously` undefined | `onShare` throws "cloud config unavailable" | Defensive only — should never fire in practice |
| Viewing `#shared-{id}` while no auth (existing flow) | Unchanged | Read-only modal, no auth needed |

**Verify before implementation:** the existing `SolveDetailModal` Share button has a `shareState` machine (`'idle' | 'sharing' | 'unsharing'` — `SolveDetailModal.tsx:797-805`). Confirm during implementation that it surfaces a user-visible error message, not just resets to idle silently. If it does not, that is a separate fix and goes into the plan.

## Tests

### Unit / integration tests to add

1. **`useCloudSync` — anon path forces enabled = false.** Mock `onAuthStateChanged` to fire with `{ uid: 'anon-uid', isAnonymous: true }`. Assert `enabled === false`, `STORAGE_KEYS.CLOUD_SYNC_ENABLED` cleared in localStorage. Then fire again with a Google user — assert `enabled` returns to whatever the user had set.
2. **`useCloudSync.signInAnonymously` exposes the function.** Mock `firebase/auth.signInAnonymously` to resolve with a fake user. Call the hook's exposed method, assert returns the user.
3. **`TimerScreen onShare` provisions anon when no user.** Mount with `cloudConfig.user = null` and a mocked `signInAnonymously`. Trigger the `onShare` callback path. Assert `signInAnonymously` was called once, then `shareSolve` was called with the resulting uid.
4. **`TimerScreen onShare` skips anon provisioning when already signed in.** Mount with `cloudConfig.user = { uid: 'google-uid', isAnonymous: false }`. Trigger `onShare`. Assert `signInAnonymously` not called; `shareSolve` called with `'google-uid'`.
5. **`App.tsx` debug panel branch — anon shows "Sign in with Google".** Render with `cloudSync.user = anon user`. Assert "Sign in with Google" button is present and email line is not.

### Existing tests that should still pass

- All `firestoreSharing.test.ts` tests (uid-agnostic).
- All `SolveDetailModal.test.tsx` share-related tests (no behavior change to the modal itself).
- All `useSharedSolve.test.ts` tests (viewer flow unchanged).

### Tests explicitly NOT added

- Tests that hit real Firebase. Existing tests mock the SDK; we keep that boundary.
- Tests for the orphan-share footgun (covered by future-work item, not v1.31.0).

### Manual QA additions for `docs/manual-test-checklist.md`

1. Fresh browser, never signed in → click Share on a local solve → URL appears, paste in another tab → loads.
2. After (1), click Unshare on the same solve → URL no longer resolves.
3. After (1), reload the page → solve still shows shared state (Firebase auto-restores anon session from IndexedDB).
4. After (1), open the cloud-sync debug panel → still shows "Not signed in / Sign in with Google" (no stale "Signed in as undefined").
5. After (1), open the same shared URL in a different browser → loads (read-only viewer).
6. Existing Google-sign-in share/unshare flow → unchanged.

## Documentation

| File | Change |
|---|---|
| `docs/firebase-cloud-sync.md` | New section: "Anonymous auth for sharing" — explains the silent `signInAnonymously()` on Share click, that anon users still write solves to localStorage (cloud-sync-of-solves still requires Google), and the per-browser unshare caveat. |
| `docs/storage.md` | Note: Firebase persists the anonymous session in IndexedDB (`firebaseLocalStorageDb`); we do not store the uid ourselves. No new sans_cube-owned localStorage keys. |
| `docs/devlog.md` | New entry under `## v1.31.0 — Public sharing without cloud sync (YYYY-MM-DD HH:MM)`. TL;DR table row at top. |
| `docs/ui-architecture.md` | Update only if the prop surface materially changed. The change here is internal to TimerScreen and likely needs no edit. Confirm during implementation. |
| `future.md` | Cross off no items (this is new work). The two anon-related items (account merging, shareOwnerUid hide) stay open. |

## Versioning & Rollout

- **Version:** `v1.31.0`.
- **Branch name:** `feat/share-without-cloud-sync`.
- **Tag at merge:** `v1.31.0` (three-part semver, project convention).

### Pre-implementation checklist

- [ ] Confirm `main` is clean of pending share-related work. Currently `handoff.md` and an unrelated `tests/check_scramble.test.ts` are untracked.
- [ ] Verify the Firestore rules deployed in production match the spec at `docs/superpowers/specs/2026-04-13-solve-sharing-design.md` — the byte-cap experiment was reverted and the rule should be back to the registry-doc-`exists()` form. Confirm in Firebase Console before merge.
- [ ] Decide whether `handoff.md` stays in the repo. Recommendation: this spec supersedes it; `git rm handoff.md` in the same commit that adds this spec.

## Out of scope (locked)

- Anon → Google account merging — tracked in `future.md`.
- `shareOwnerUid` ownership stamping to hide Unshare cleanly — tracked in `future.md`.
- App-side rate limiting.
- Cloud Monitoring alerts on Firestore write counts.
- Migrating localStorage-only users' previous shares — they have none, the gate prevented it.

## Reference data points (collected during prior design pass)

- **Spark tier limits:** 20K writes/day, 50K reads/day, 1 GiB storage. Spark cannot be billed; abuse → quota exhausted → temporary unavailability, not a bill.
- **Worst real solve size:** 124 KB (id=1776595511829, seq=632, 318 moves, 815 snapshots). Well under any byte cap we'd care about.
- **Cost per share op:** 2 writes (registry + public_solves). 5,000 anon shares = quota exhausted for the day.
