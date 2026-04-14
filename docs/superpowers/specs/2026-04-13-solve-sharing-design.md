# Solve Sharing Design

**Date:** 2026-04-13  
**Status:** Ready for implementation

## Overview

Allow cloud sync users to share a solve publicly via a URL. Anyone can view the full solve detail (phase breakdown, replay, move list) without logging in. Sharing is opt-in per solve: the owner generates a link, and can revoke it later.

---

## Constraints

- Sharing requires cloud sync to be enabled (solve must be in Firestore)
- Viewers do not need to log in or enable cloud sync
- When the owner updates a solve (e.g. changes method), the shared copy updates automatically
- If the owner deletes a solve, the shared copy persists (no cascade delete)

---

## Data Model

### `SolveRecord` — new optional field

```ts
shareId?: string   // Firestore auto-generated ID in public_solves; absent = not shared
```

### `public_solves/{shareId}` — new top-level collection

```ts
{
  solve: SolveRecord    // full snapshot; no ownerUid to avoid exposing it publicly
}
```

### `users/{uid}/shared_solves/{shareId}` — new private subcollection

```ts
{}   // empty document; existence = ownership proof for Firestore rules
```

Ownership is verified server-side via `exists()` in Firestore rules — `ownerUid` is never stored in the public document.

---

## Firestore Security Rules

Full replacement for the rules configured in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Private solves — owner only (unchanged)
    match /users/{userId}/solves/{solveId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Private ownership registry — owner only
    match /users/{userId}/shared_solves/{shareId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Public shared solves
    match /public_solves/{shareId} {
      // Anyone can fetch a specific document by ID; listing the collection is blocked
      allow get: if true;
      allow list: if false;

      // Only the owner (verified via private registry) can create, update, or delete
      allow create, update: if request.auth != null
        && exists(/databases/$(database)/documents/users/$(request.auth.uid)/shared_solves/$(shareId))
        && request.resource.data.keys().hasAll(['solve'])
        && request.resource.size < 200000;
      allow delete: if request.auth != null
        && exists(/databases/$(database)/documents/users/$(request.auth.uid)/shared_solves/$(shareId));
    }
  }
}
```

**Security notes:**
- `allow list: if false` prevents scraping all public solves by iterating the collection
- Size limit (200 KB) prevents oversized documents
- Required-field validation on write ensures the document shape is always valid
- `ownerUid` is never stored in `public_solves` — viewers cannot determine who owns a solve
- Documenting these rules is safe: Firestore enforces them server-side regardless

---

## Share ID

Use Firestore's auto-generated doc ID:

```ts
const shareId = doc(collection(db, 'public_solves')).id
```

20-char base62 string (e.g. `aB3kR9mNpQxZ7wLdUvTy`). No new dependency. Collision-proof in practice.

---

## Share / Unshare / Update Flow

### Share
1. Generate `shareId` via Firestore auto-ID
2. Write `users/{uid}/shared_solves/{shareId}` → `{}` **(registry first — required for the create rule's `exists()` check)**
3. Write `public_solves/{shareId}` → `{ solve }`
4. Update `solve.shareId = shareId` → persist via existing `updateSolve` path

### Unshare
1. Delete `public_solves/{shareId}` **(public doc first — registry must still exist for the delete rule's `exists()` check)**
2. Delete `users/{uid}/shared_solves/{shareId}`
3. Clear `solve.shareId` → persist via existing `updateSolve` path

### Update (e.g. method change)
- Existing `updateSolve` path (already calls `updateSolveInFirestore`)
- Add: if `solve.shareId` is set, also call `updateSharedSolve(shareId, solve)` → `setDoc` on `public_solves/{shareId}`
- No change to the ownership registry doc needed

### Delete
- No action on `public_solves` — the shared copy persists after the original is deleted

---

## URL Format

```
https://sansword.github.io/sans_cube/#shared-{shareId}
```

Consistent with the existing `#solve-N` hash pattern. The `#shared-` prefix is the route identifier; everything after the dash is the shareId.

Example:
```
https://sansword.github.io/sans_cube/#shared-aB3kR9mNpQxZ7wLdUvTy
```

---

## New Service Functions

Add to a new `src/services/firestoreSharing.ts`:

```ts
// Generate a new shareId without writing anything
function newShareId(): string

// Create public doc + ownership registry; returns shareId
async function shareSolve(uid: string, solve: SolveRecord): Promise<string>

// Delete public doc + ownership registry
async function unshareSolve(uid: string, shareId: string): Promise<void>

// Update the public copy of a shared solve
async function updateSharedSolve(shareId: string, solve: SolveRecord): Promise<void>

// Fetch a shared solve by shareId (no auth required)
async function loadSharedSolve(shareId: string): Promise<SolveRecord | null>
```

---

## URL Routing

Extend the existing hash routing in `App.tsx` (already handles `#solve-N` and `#trends`):

- On boot and on `hashchange`: check if hash matches `#shared-{shareId}`
- If matched: call `loadSharedSolve(shareId)`, then open `SolveDetailModal` in read-only mode
- If `loadSharedSolve` returns null: show a brief inline message "Solve not found or no longer shared", then clear the hash and show the normal app

---

## Viewer Experience

When a viewer opens a shared URL:

1. App boots normally (no login required)
2. Hash `#shared-{shareId}` is detected
3. Fetch `public_solves/{shareId}` from Firestore (single read, no auth)
4. `SolveDetailModal` opens in **read-only mode**: full phase bar, replay, move list visible; edit/delete/share controls hidden
5. URL stays intact so the viewer can bookmark or reload

If the document does not exist (unshared or bad ID): show "Solve not found or no longer shared" briefly, then restore the app to its default state.

---

## UI Changes — `SolveDetailModal`

A **Share** button is added to the modal footer alongside existing controls.

### States

| State | UI |
|---|---|
| Not shared | "Share" button |
| Sharing in progress | Button disabled with spinner |
| Shared | Read-only URL input + "Copy" button + "Unshare" button |
| Unsharing in progress | Buttons disabled with spinner |
| Viewer (read-only mode) | No share controls shown |

The URL field is a read-only `<input>` so the user can also manually select and copy. The "Copy" button uses `navigator.clipboard.writeText`.

### Share button availability

The Share button is only shown when:
- The solve is the user's own (not in viewer mode)
- The user has cloud sync enabled and is signed in

If cloud sync is off, the Share button is not shown (sharing requires the solve to be in Firestore).

---

## Files Changed

| File | Change |
|---|---|
| `src/types/solve.ts` | Add `shareId?: string` to `SolveRecord` |
| `src/services/firestoreSharing.ts` | New file: `shareSolve`, `unshareSolve`, `updateSharedSolve`, `loadSharedSolve`, `newShareId` |
| `src/hooks/useSolveHistory.ts` | Call `updateSharedSolve` inside `updateSolve` when `solve.shareId` is set |
| `src/components/SolveDetailModal.tsx` | Add share button + URL display + read-only mode prop |
| `src/App.tsx` | Extend hash routing to handle `#shared-{shareId}` |
| `docs/firebase-cloud-sync.md` | Document `public_solves` collection, updated rules, sharing flow |
| `docs/storage.md` | Document `public_solves/{shareId}` and `users/{uid}/shared_solves/{shareId}` |
| `docs/ui-architecture.md` | Update `SolveDetailModal` props table |
