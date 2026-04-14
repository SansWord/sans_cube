# Firebase Cloud Sync

Solve history is stored locally in `localStorage` by default. Cloud sync is an opt-in feature that persists solves to Firebase Firestore, enabling cross-device access.

## How it works

- Toggle is in **debug mode** (top-right mode switch → debug)
- Requires signing in with a Google account
- Each user's solves are stored separately — no one can see another user's data
- When you first enable it, existing local solves are migrated to Firestore automatically
- Once enabled, reads and writes go to Firestore only (no local copy)

## Firebase setup (for developers / self-hosting)

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Add a **Web app** and copy the config object

### 2. Enable services

- **Authentication → Sign-in method → Google** — enable it
- **Firestore Database** — create in production mode

### 3. Set Firestore security rules

In Firebase Console → Firestore → Rules, copy and paste the rules below, then click **Publish**:

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

> **Note:** You must manually apply these rules in the Firebase Console. Copy the entire rules block above, paste it in the Firestore Rules editor, and click **Publish**.

### 4. Configure environment variables

Create `.env.local` in the project root (never commit this file):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Fill in the values from your Firebase web app config.

### 5. Add authorized domain (for GitHub Pages)

Firebase Console → Authentication → Settings → Authorized domains → add `sansword.github.io`.

## Data model

Solves are stored at:

```
users/{uid}/solves/{date}
```

Where `{date}` is `String(solve.date)` — the Unix timestamp (ms) when the solve was recorded. This is unique per solve and doubles as a natural sort key.

Each document is a serialized `SolveRecord` object (see `src/types/solve.ts`).

## Firestore operations

| Function | Description |
|----------|-------------|
| `loadSolvesFromFirestore(uid)` | Load all solves ordered by date |
| `addSolveToFirestore(uid, solve)` | Write a new solve doc (idempotent `setDoc`) |
| `updateSolveInFirestore(uid, solve)` | Update an existing solve doc in place (same `setDoc`, uses `solve.date` as doc ID) |
| `deleteSolveFromFirestore(uid, solve)` | Delete a solve doc |

## Deployment (GitHub Pages)

Firebase config values are stored as GitHub Actions secrets (repo → Settings → Secrets and variables → Actions). The deploy workflow injects them at build time so they're baked into the JS bundle.

See `.github/workflows/deploy.yml` for the full workflow.

> **Note:** Firebase web API keys are not sensitive secrets — they identify the project but access is controlled by Firestore security rules. Storing them as GitHub secrets just keeps them out of the git history.

## Migration behavior

When cloud sync is first enabled in a session, the following happens:

1. If there are solves in localStorage, they are **migrated to Firestore** first (once per session, guarded by `migratedRef`)
2. All solves are then loaded from Firestore

Migration uses `setDoc` (upsert), so re-running it on page reload is safe — solves with the same document ID are overwritten, not duplicated.

**When both localStorage and Firestore already have solves:** both sets end up in Firestore after migration. Since document IDs are based on `solve.date` (Unix timestamp in ms), duplicates only occur if two solves share the exact same timestamp — which cannot happen in practice.

Migration direction is **local → Firestore only**. Firestore data is never written back to localStorage.

## Solve ID design

| Mode | ID source | Example |
|------|-----------|---------|
| localStorage | Sequential integer, starting from 1, persisted to `localStorage` | `1`, `2`, `3` |
| Cloud sync | `Date.now()` at solve completion | `1775676812105` |

The two ranges never overlap (a sequential counter starting from 1 cannot reach a 13-digit Unix timestamp), so there are no cross-mode ID conflicts.

Within cloud mode, two solves finishing in the same millisecond would conflict — but a solve takes at minimum several seconds, making this impossible in practice.

The `authDomain` env var should always be set to the Firebase-provided domain (e.g. `your-project.firebaseapp.com`), not the GitHub Pages domain. Firebase Auth uses it internally for the OAuth flow.

## Admin access

There is no in-app admin view. To inspect any user's data, use the [Firebase Console](https://console.firebase.google.com) → Firestore → browse the `users` collection.

## User IDs

Firebase assigns each user a permanent UID when they sign in with Google. The same Google account always gets the same UID across all devices. You never generate or manage UIDs — `onAuthStateChanged` returns the signed-in user object and `user.uid` is read from it.

## Local development

`npm run dev` works out of the box. Firebase Auth automatically whitelists `localhost`, so Google Sign-In works without any extra configuration. Ensure `.env.local` exists with the Firebase config values before starting the dev server.

## Security

### API key exposure

The Firebase config (including API key) is baked into the JS bundle and visible to anyone who inspects the page source. This is expected — Firebase web API keys are not secrets. Access control is enforced by Firestore security rules and Firebase Auth, not by the key itself.

### Risk 1: Script abuse via extracted API key

A malicious user could extract the API key from the bundle and write a script that creates accounts and floods Firestore with writes, exhausting your free-tier quota.

**Mitigation: Firebase App Check**

App Check ties your Firebase project to your specific deployed app using reCAPTCHA v3. Requests not originating from your actual web page are rejected before reaching Firestore.

Setup: Firebase Console → App Check → register your app with reCAPTCHA v3 (free). Add to `src/services/firebase.ts`:

```typescript
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
  isTokenAutoRefreshEnabled: true,
})
```

Enable App Check enforcement in the Firebase Console after registering. Add App Check to the deploy workflow if needed (reCAPTCHA site keys are safe to commit).

### Risk 2: Oversized or malformed documents

A legitimate user could write extremely large solve records or documents missing required fields.

**Mitigation: Firestore rule validation**

Replace the basic security rule with this stricter version:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/solves/{solveId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                && request.auth.uid == userId
                && request.resource.data.keys().hasAll(['id', 'date', 'timeMs', 'moves', 'phases'])
                && request.resource.size < 100000;
    }
  }
}
```

This limits each solve document to 100KB and requires the core fields to be present.

### Free-tier limits as a natural ceiling

Even without the above mitigations, the Firebase free tier caps at 20k writes/day and 1GB total storage across all users. For a personal cubing app this is unlikely to be a concern, but it does bound worst-case abuse.

**Recommended priority:** Add App Check before sharing the app URL publicly. The document size rule is a low-effort addition worth including in the Firestore rules from the start.

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
