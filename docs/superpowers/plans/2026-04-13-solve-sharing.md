# Solve Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow cloud-sync users to generate a public share link for any solve; anyone can open the link and view the full solve detail (phase breakdown, replay, move list) without logging in.

**Architecture:** A new `public_solves/{shareId}` Firestore collection holds shared solve snapshots, with ownership tracked in a private `users/{uid}/shared_solves/{shareId}` registry so the public doc never exposes the owner's UID. Hash routing (`#shared-{shareId}`) opens a read-only `SolveDetailModal` in `TimerScreen`. Updating a solve syncs the public copy automatically via `useSolveHistory.updateSolve`.

**Tech Stack:** React 19 + TypeScript, Firebase Firestore (firebase/firestore), Vitest

**Spec:** `docs/superpowers/specs/2026-04-13-solve-sharing-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/solve.ts` | Modify | Add `shareId?: string` to `SolveRecord` |
| `src/services/firestoreSharing.ts` | **Create** | All share/unshare/load Firestore operations |
| `src/hooks/useSolveHistory.ts` | Modify | Sync public copy in `updateSolve` when `shareId` is set |
| `src/components/SolveDetailModal.tsx` | Modify | Share button + URL display + `readOnly` prop |
| `src/components/TimerScreen.tsx` | Modify | Share/unshare handlers, viewer mode, `#shared-` routing |
| `tests/services/firestoreSharing.test.ts` | **Create** | Tests for `newShareId` and `SHARE_ID_RE` |
| `docs/firebase-cloud-sync.md` | Modify | Document `public_solves`, updated Firestore rules, sharing flow |
| `docs/storage.md` | Modify | Document new Firestore paths |
| `docs/ui-architecture.md` | Modify | Update `SolveDetailModal` props table |

---

## Task 1: Add `shareId` to `SolveRecord`

**Files:**
- Modify: `src/types/solve.ts`

- [ ] **Step 1: Add the field**

In `src/types/solve.ts`, add one line after `method?: string`:

```ts
export interface SolveRecord {
  id: number
  seq?: number
  scramble: string
  timeMs: number
  moves: Move[]
  phases: PhaseRecord[]
  date: number
  quaternionSnapshots?: QuaternionSnapshot[]
  driver?: 'cube' | 'mouse'
  isExample?: boolean
  method?: string
  shareId?: string    // Firestore doc ID in public_solves; absent = not shared
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/solve.ts
git commit -m "feat: add shareId field to SolveRecord"
```

---

## Task 2: Create `firestoreSharing.ts` service

**Files:**
- Create: `src/services/firestoreSharing.ts`
- Create: `tests/services/firestoreSharing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/firestoreSharing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { newShareId, SHARE_ID_RE } from '../../src/services/firestoreSharing'

describe('SHARE_ID_RE', () => {
  it('accepts a valid 20-char base62 ID', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQxZ7wLdUvTy')).toBe(true)
  })

  it('rejects IDs shorter than 20 chars', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQx')).toBe(false)
  })

  it('rejects IDs longer than 20 chars', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQxZ7wLdUvTyXX')).toBe(false)
  })

  it('rejects IDs with non-base62 characters', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQ-Z7wLdUvTy')).toBe(false)
    expect(SHARE_ID_RE.test('aB3kR9mNpQ_Z7wLdUvTy')).toBe(false)
  })
})

describe('newShareId', () => {
  it('returns a 20-char base62 string', () => {
    const id = newShareId()
    expect(id).toMatch(SHARE_ID_RE)
  })

  it('returns unique IDs on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newShareId()))
    expect(ids.size).toBe(20)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- tests/services/firestoreSharing.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the service**

Create `src/services/firestoreSharing.ts`:

```ts
import { collection, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { SolveRecord } from '../types/solve'

// Regex for validating a share ID extracted from a URL hash
export const SHARE_ID_RE = /^[A-Za-z0-9]{20}$/

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// Generate a 20-char base62 ID — same character space as Firestore auto-IDs
export function newShareId(): string {
  return Array.from({ length: 20 }, () => BASE62[Math.floor(Math.random() * 62)]).join('')
}

function publicSolveRef(shareId: string) {
  return doc(collection(db, 'public_solves'), shareId)
}

function registryRef(uid: string, shareId: string) {
  return doc(db, 'users', uid, 'shared_solves', shareId)
}

// Strip undefined values before writing to Firestore
function sanitize(solve: SolveRecord): object {
  return JSON.parse(JSON.stringify(solve))
}

/**
 * Share a solve publicly.
 * Registry doc is written first so the Firestore create rule's exists() check passes.
 * Returns the new shareId.
 */
export async function shareSolve(uid: string, solve: SolveRecord): Promise<string> {
  const shareId = newShareId()
  await setDoc(registryRef(uid, shareId), {})
  await setDoc(publicSolveRef(shareId), { solve: sanitize(solve) })
  return shareId
}

/**
 * Unshare a solve.
 * Public doc is deleted first while the registry still exists (required for the delete rule).
 * Then the registry doc is deleted.
 */
export async function unshareSolve(uid: string, shareId: string): Promise<void> {
  await deleteDoc(publicSolveRef(shareId))
  await deleteDoc(registryRef(uid, shareId))
}

/**
 * Update the public copy of a shared solve.
 * Called whenever the owner updates the solve (e.g. method change).
 */
export async function updateSharedSolve(shareId: string, solve: SolveRecord): Promise<void> {
  await setDoc(publicSolveRef(shareId), { solve: sanitize(solve) })
}

/**
 * Fetch a shared solve by shareId. No auth required.
 * Returns null if the document does not exist.
 */
export async function loadSharedSolve(shareId: string): Promise<SolveRecord | null> {
  const snap = await getDoc(publicSolveRef(shareId))
  if (!snap.exists()) return null
  return snap.data().solve as SolveRecord
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- tests/services/firestoreSharing.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/firestoreSharing.ts tests/services/firestoreSharing.test.ts
git commit -m "feat: add firestoreSharing service"
```

---

## Task 3: Sync public copy on solve update

**Files:**
- Modify: `src/hooks/useSolveHistory.ts`

- [ ] **Step 1: Add the import**

At the top of `src/hooks/useSolveHistory.ts`, add after the existing `firestoreSolves` import block:

```ts
import { updateSharedSolve } from '../services/firestoreSharing'
```

- [ ] **Step 2: Update `updateSolve`**

Replace the existing `updateSolve` callback (lines 178–189) with:

```ts
const updateSolve = useCallback(async (updated: SolveRecord): Promise<void> => {
  if (useCloud && uid) {
    setCloudSolves((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    await updateSolveInFirestore(uid, updated)
    if (updated.shareId) {
      void updateSharedSolve(updated.shareId, updated)
    }
  } else {
    setLocalSolves((prev) => {
      const next = prev.map((s) => s.id === updated.id ? updated : s)
      saveLocalSolves(next)
      return next
    })
  }
}, [useCloud, uid])
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSolveHistory.ts
git commit -m "feat: sync public solve copy on update"
```

---

## Task 4: Add share UI to `SolveDetailModal`

**Files:**
- Modify: `src/components/SolveDetailModal.tsx`

- [ ] **Step 1: Extend the Props interface**

Replace the existing `Props` interface (lines 18–24):

```ts
interface Props {
  solve: SolveRecord
  onClose: () => void
  onDelete: (id: number) => void
  onUseScramble?: (scramble: string) => void
  onUpdate: (solve: SolveRecord) => Promise<void>
  onShare?: (solve: SolveRecord) => Promise<string>
  onUnshare?: (shareId: string) => Promise<void>
  readOnly?: boolean
}
```

- [ ] **Step 2: Add share state and destructure new props**

In the component function signature (line 59), add the new props:

```ts
export function SolveDetailModal({ solve, onClose, onDelete, onUseScramble, onUpdate, onShare, onUnshare, readOnly }: Props) {
```

Add these state declarations after the existing ones (after `const [copiedExample, setCopiedExample] = useState(false)` on line 70):

```ts
type ShareState = 'idle' | 'sharing' | 'unsharing'
const [shareState, setShareState] = useState<ShareState>('idle')
const [shareCopied, setShareCopied] = useState(false)
```

- [ ] **Step 3: Add share/unshare handlers**

Add these two functions after `copyAsExample` (after line 145):

```ts
async function handleShare() {
  if (!onShare || shareState !== 'idle') return
  setShareState('sharing')
  try {
    const shareId = await onShare(localSolve)
    const updated = { ...localSolve, shareId }
    setLocalSolve(updated)
    await onUpdate(updated)
  } catch {
    // silently revert — share failure is non-critical
  } finally {
    setShareState('idle')
  }
}

async function handleUnshare() {
  if (!onUnshare || !localSolve.shareId || shareState !== 'idle') return
  setShareState('unsharing')
  try {
    await onUnshare(localSolve.shareId)
    const updated = { ...localSolve, shareId: undefined }
    setLocalSolve(updated)
    await onUpdate(updated)
  } catch {
    // silently revert
  } finally {
    setShareState('idle')
  }
}
```

- [ ] **Step 4: Add share URL helper**

Add this constant near the other derived values (before the `return` statement):

```ts
const shareUrl = localSolve.shareId
  ? `${window.location.origin}${window.location.pathname}#shared-${localSolve.shareId}`
  : null
```

- [ ] **Step 5: Replace the actions section**

Find the `{/* Actions */}` section (line 482 to end of component, just before the final `</div></div>`). Replace the entire actions `<div>` with:

```tsx
{/* Actions */}
{!readOnly && (
  <div className="solve-detail-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

    {/* Share row — only shown when onShare is provided */}
    {onShare && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {shareUrl ? (
          <>
            <input
              readOnly
              value={shareUrl}
              style={{
                flex: 1, padding: '5px 8px', fontSize: 11,
                background: '#161626', border: '1px solid #333',
                borderRadius: 4, color: '#aaa', fontFamily: 'monospace',
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl)
                setShareCopied(true)
                setTimeout(() => setShareCopied(false), 1500)
              }}
              style={{
                padding: '5px 10px', fontSize: 11,
                background: shareCopied ? '#27ae60' : '#2980b9',
                color: '#fff', border: 'none', borderRadius: 4,
                cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              {shareCopied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              onClick={handleUnshare}
              disabled={shareState !== 'idle'}
              style={{
                padding: '5px 10px', fontSize: 11,
                background: shareState === 'unsharing' ? '#555' : '#7f8c8d',
                color: '#fff', border: 'none', borderRadius: 4,
                cursor: shareState !== 'idle' ? 'not-allowed' : 'pointer', flexShrink: 0,
              }}
            >
              {shareState === 'unsharing' ? 'Removing…' : 'Unshare'}
            </button>
          </>
        ) : (
          <button
            onClick={handleShare}
            disabled={shareState !== 'idle'}
            style={{
              padding: '5px 12px', fontSize: 11,
              background: shareState === 'sharing' ? '#555' : '#2980b9',
              color: '#fff', border: 'none', borderRadius: 4,
              cursor: shareState !== 'idle' ? 'not-allowed' : 'pointer',
            }}
          >
            {shareState === 'sharing' ? 'Sharing…' : 'Share'}
          </button>
        )}
      </div>
    )}

    {/* Delete / confirm-delete row */}
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      {confirmDelete ? (
        <>
          <span style={{ color: '#e74c3c', fontSize: 12, marginRight: 8, alignSelf: 'center' }}>
            Delete this solve?
          </span>
          <button onClick={() => onDelete(localSolve.id)} style={{ padding: '6px 14px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>
            Confirm
          </button>
          <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px' }}>
            Cancel
          </button>
        </>
      ) : (
        <>
          {!localSolve.isExample && (
            <button
              onClick={copyAsExample}
              style={{ padding: '6px 14px', background: copiedExample ? '#27ae60' : '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 8, transition: 'background 0.2s' }}
              title="Copy solve JSON for use as an example solve in exampleSolves.ts"
            >
              {copiedExample ? 'Copied!' : 'Copy as example'}
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={saving || shareState !== 'idle'}
            style={{ padding: '6px 14px', background: (saving || shareState !== 'idle') ? '#555' : '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: (saving || shareState !== 'idle') ? 'not-allowed' : 'pointer' }}
          >
            Delete
          </button>
        </>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/SolveDetailModal.tsx
git commit -m "feat: add share/unshare UI to SolveDetailModal"
```

---

## Task 5: Wire share/unshare in `TimerScreen.tsx`

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Add the import**

Add to the imports at the top of `src/components/TimerScreen.tsx` (after the existing imports):

```ts
import { shareSolve, unshareSolve } from '../services/firestoreSharing'
```

- [ ] **Step 2: Update the `SolveDetailModal` render**

Find the `{selectedSolve && (` block (around line 376) and replace the `SolveDetailModal` render:

```tsx
{selectedSolve && (
  <SolveDetailModal
    solve={selectedSolve}
    onClose={() => setSelectedSolve(null)}
    onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
    onUseScramble={(s) => { loadScramble(s); setSelectedSolve(null) }}
    onUpdate={async (updated) => { await updateSolve(updated) }}
    onShare={cloudConfig?.enabled && cloudConfig?.user
      ? async (solve) => shareSolve(cloudConfig.user!.uid, solve)
      : undefined
    }
    onUnshare={cloudConfig?.enabled && cloudConfig?.user
      ? async (shareId) => unshareSolve(cloudConfig.user!.uid, shareId)
      : undefined
    }
  />
)}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: wire share/unshare handlers in TimerScreen"
```

---

## Task 6: Add `#shared-` hash routing and viewer mode

**Files:**
- Modify: `src/components/TimerScreen.tsx`

- [ ] **Step 1: Add shared-solve state**

In `TimerScreen`, add these state declarations after the existing `const [showTrends, setShowTrends] = useState(false)` line:

```ts
const [sharedSolve, setSharedSolve] = useState<SolveRecord | null>(null)
const [sharedSolveLoading, setSharedSolveLoading] = useState(false)
const [sharedSolveNotFound, setSharedSolveNotFound] = useState(false)
```

- [ ] **Step 2: Add the import for `loadSharedSolve` and `SHARE_ID_RE`**

Update the firestoreSharing import line (added in Task 5):

```ts
import { shareSolve, unshareSolve, loadSharedSolve, SHARE_ID_RE } from '../services/firestoreSharing'
```

- [ ] **Step 3: Add boot-time `#shared-` detection**

Add a new `useEffect` after the existing `urlResolvedRef` effect (after the block ending with `}, [cloudLoading, solves])`):

```ts
// Resolve #shared-{shareId} on boot — does not require auth or cloudLoading
useEffect(() => {
  const hash = window.location.hash
  if (!hash.startsWith('#shared-')) return
  const shareId = hash.replace('#shared-', '')
  if (!SHARE_ID_RE.test(shareId)) return

  setSharedSolveLoading(true)
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
  void Promise.race([loadSharedSolve(shareId), timeout]).then((solve) => {
    setSharedSolveLoading(false)
    if (solve) {
      setSharedSolve(solve)
    } else {
      setSharedSolveNotFound(true)
      history.replaceState(null, '', window.location.pathname + window.location.search)
      setTimeout(() => setSharedSolveNotFound(false), 3000)
    }
  })
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Extend the `hashchange` listener**

In the existing `handleHashChange` function (inside the `useEffect` with `[solves]` dependency), add a `#shared-` case. The full updated handler:

```ts
const handleHashChange = () => {
  const hash = window.location.hash
  if (hash.startsWith('#trends')) {
    setSelectedSolve(null)
    setShowTrends(true)
  } else if (hash.startsWith('#solve-')) {
    const id = parseInt(hash.replace('#solve-', ''), 10)
    const solve = solves.find(s => s.id === id)
    if (solve) { setShowTrends(false); setSelectedSolve(solve) }
  } else if (hash.startsWith('#shared-')) {
    const shareId = hash.replace('#shared-', '')
    if (!SHARE_ID_RE.test(shareId)) return
    setSharedSolveLoading(true)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
    void Promise.race([loadSharedSolve(shareId), timeout]).then((solve) => {
      setSharedSolveLoading(false)
      if (solve) {
        setSelectedSolve(null)
        setShowTrends(false)
        setSharedSolve(solve)
      } else {
        setSharedSolveNotFound(true)
        history.replaceState(null, '', window.location.pathname + window.location.search)
        setTimeout(() => setSharedSolveNotFound(false), 3000)
      }
    })
  } else {
    setSelectedSolve(null)
    setShowTrends(false)
  }
}
```

- [ ] **Step 5: Guard the URL-update effect against clearing `#shared-` hashes**

Find the existing `useEffect` that calls `history.replaceState` based on `selectedSolve`/`showTrends`. Update the guard and dependency array:

```ts
useEffect(() => {
  if (!urlResolvedRef.current) return
  if (showTrends || !!sharedSolve) return
  if (selectedSolve) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#solve-${selectedSolve.id}`)
  } else {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}, [selectedSolve, showTrends, sharedSolve])
```

- [ ] **Step 6: Add the shared-solve loading overlay and not-found banner**

In the JSX return, add after the existing `{cloudLoading && (() => { ... })()}` block (before the closing `</div>`):

```tsx
{/* Loading overlay for shared solve */}
{sharedSolveLoading && (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'all',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#111', border: '1px solid #333', borderRadius: 8,
      padding: '10px 18px', color: '#888', fontSize: 13,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid #333', borderTopColor: '#888',
        animation: 'spin 0.8s linear infinite', flexShrink: 0,
      }} />
      Loading shared solve…
    </div>
  </div>
)}

{/* Not-found banner for shared solve */}
{sharedSolveNotFound && (
  <div style={{
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    zIndex: 300, background: '#1a1a2e', border: '1px solid #555',
    borderRadius: 8, padding: '10px 18px', color: '#aaa', fontSize: 13,
  }}>
    Solve not found or no longer shared.
  </div>
)}
```

- [ ] **Step 7: Render the shared-solve modal in viewer (read-only) mode**

Add after the existing `{selectedSolve && ( ... )}` block:

```tsx
{sharedSolve && (
  <SolveDetailModal
    solve={sharedSolve}
    onClose={() => {
      setSharedSolve(null)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }}
    onDelete={() => {}}
    onUpdate={async () => {}}
    readOnly
  />
)}
```

- [ ] **Step 8: Also extend the existing cloudLoading overlay label switch**

In the existing loading overlay block (the `cloudLoading && (() => {...})()` section), extend the label switch to also mention `#shared-` so it shows a label if cloudLoading happens to be true while a shared hash is present (edge case, handled cleanly):

```ts
const label = h.startsWith('#trends') ? 'Syncing trends from cloud…'
  : h.startsWith('#solve-') ? 'Syncing solve from cloud…'
  : h.startsWith('#shared-') ? 'Loading shared solve…'
  : null
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 10: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: add #shared- hash routing and viewer mode"
```

---

## Task 7: Update documentation

**Files:**
- Modify: `docs/firebase-cloud-sync.md`
- Modify: `docs/storage.md`
- Modify: `docs/ui-architecture.md`

- [ ] **Step 1: Apply updated Firestore security rules in Firebase Console**

Go to [Firebase Console](https://console.firebase.google.com) → your project → Firestore Database → Rules tab. Replace the entire rules content with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId}/solves/{solveId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/shared_solves/{shareId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /public_solves/{shareId} {
      allow get: if true;
      allow list: if false;
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

Click **Publish**.

- [ ] **Step 3: Update `firebase-cloud-sync.md`**

Update the **Set Firestore security rules** section (under `### 3. Set Firestore security rules`). Replace the existing rules block with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Private solves — owner only
    match /users/{userId}/solves/{solveId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Private ownership registry for shared solves — owner only
    match /users/{userId}/shared_solves/{shareId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Public shared solves — anyone can fetch by ID, only owner can write
    match /public_solves/{shareId} {
      allow get: if true;
      allow list: if false;
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

Then add a new section at the bottom of `firebase-cloud-sync.md`:

```markdown
## Solve Sharing

Cloud sync users can share individual solves publicly via a link (`#shared-{shareId}`). The viewer does not need to be logged in.

### How it works

- Share is opt-in per solve, via the Share button in `SolveDetailModal`
- Clicking Share writes two documents:
  1. `users/{uid}/shared_solves/{shareId}` — empty ownership registry (private)
  2. `public_solves/{shareId}` — solve snapshot (publicly readable by ID)
- The `shareId` is stored in `SolveRecord.shareId` and persisted via `updateSolve`
- When the owner updates the solve (e.g. changes method), `useSolveHistory.updateSolve` automatically syncs the public copy
- Unsharing deletes the public doc then the registry doc
- Deleting a solve does NOT delete the shared copy — the public link persists

### Security

- `public_solves` allows `get` (fetch by ID) but not `list` (enumerate collection)
- Ownership is verified server-side via `exists()` on the private registry — the owner's UID is never stored in the public document
- Document size is capped at 200 KB
```

- [ ] **Step 4: Update `storage.md`**

In the **Firestore Structure** section, add a new entry after the `users/{uid}/meta/counter` section:

```markdown
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
```

Also add two rows to the **What Syncs from Firestore vs. localStorage Only** table:

```markdown
| Shared solve snapshot | — | `public_solves/{shareId}` | Written on share, updated on solve update, deleted on unshare |
| Share ownership registry | — | `users/{uid}/shared_solves/{shareId}` | Private; presence proves ownership for Firestore rules |
```

- [ ] **Step 5: Update `ui-architecture.md`**

In the `SolveDetailModal` section (under `### SolveDetailModal`), update the Props line to:

```
Props: `onUpdate`, `onDelete`, `onShare?`, `onUnshare?`, `readOnly?` — `onShare`/`onUnshare` are only passed when cloud sync is enabled and the user is signed in. When `readOnly` is true (viewer mode), all action controls (delete, share, copy-as-example) are hidden.
```

Also update the component tree to show the viewer-mode modal:

```
            ├── SolveDetailModal     ← rendered when a solve is selected (can overlay TrendsModal)
            └── SolveDetailModal     ← rendered in read-only mode when #shared-{shareId} is open
```

- [ ] **Step 6: Commit**

```bash
git add docs/firebase-cloud-sync.md docs/storage.md docs/ui-architecture.md
git commit -m "docs: update firebase-cloud-sync, storage, and ui-architecture for solve sharing"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Manual smoke test checklist**

Start the dev server: `npm run dev`

1. **Share a solve** — enable cloud sync, open a solve, click Share → URL appears in the input
2. **Copy link** — click Copy link → URL is in clipboard
3. **Reload shared URL** — paste the URL in a new tab → loading overlay appears → SolveDetailModal opens in read-only mode (no Delete, no Share, no Copy as example)
4. **Share button availability** — disable cloud sync, open a solve → no Share button
5. **Update syncs** — with a shared solve open, change method → re-open the shared URL in another tab → verify the updated method is reflected
6. **Unshare** — click Unshare → URL disappears, Share button returns
7. **Bad share URL** — navigate to `#shared-badid` → no crash, URL cleared
8. **Unknown shareId** — navigate to `#shared-aaaabbbbccccddddeeee` → "Solve not found" banner appears briefly
9. **Timeout** — (manual only) throttle network in DevTools → loading overlay shown → after 3s, not-found banner appears

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -p
git commit -m "fix: <description of any fix>"
```
