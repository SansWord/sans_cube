# Data Backup & Restore

How to back up and restore solve data before risky operations (migrations, schema changes, testing).

---

## localStorage Backup

Open the app in Chrome, open DevTools (`F12`) → Console tab.

**Export to file:**
```js
const data = localStorage.getItem('sans_cube_solves')
const blob = new Blob([data], { type: 'application/json' })
const a = document.createElement('a')
a.href = URL.createObjectURL(blob)
a.download = 'sans_cube_solves_backup.json'
a.click()
```

This downloads `sans_cube_solves_backup.json` to your Downloads folder.

**Restore from backup:**
```js
const backup = `paste the full JSON string here`
localStorage.setItem('sans_cube_solves', backup)
location.reload()
```

Or if you have the file, paste its contents as the string value.

---

## Firestore Backup

### Option 1: Firebase Console (recommended)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → your project
2. Firestore Database → find your `solves` collection (under the user's UID document)
3. Click the three-dot menu next to the collection → **Export collection**

### Option 2: Browser console while signed in

Paste this in the app's DevTools console while signed in with Google:

```js
// Lists all your Firestore solves as JSON in the console
const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js')
// Note: use the app's already-initialized Firestore instead — see firestoreSolves.ts
```

In practice, the Firebase console export is simpler and more reliable for Firestore backups.

---

## What to Back Up

| Scenario | Back up |
|----------|---------|
| Testing localStorage migration | `sans_cube_solves` (localStorage) |
| Testing Firestore migration button | Firestore `solves` collection |
| Both | Both |

---

## Notes

- The localStorage key `sans_cube_solves` holds a JSON array of `SolveRecord` objects. A fresh install with no solves will have `null` or an empty array.
- Firestore solves are stored per-user under `users/{uid}/solves/{id}`. Each document is one `SolveRecord`.
- After a migration, the backup lets you verify the before/after diff or roll back if something looks wrong.
