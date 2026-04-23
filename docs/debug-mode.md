# Debug Mode

Debug mode is toggled via the **[debug]** button in `ConnectionBar`. It replaces the timer screen with a set of diagnostic and maintenance tools. It is not visible to normal users — it's accessed manually by toggling the mode.

## How to access

Click the **[debug]** / **[timer]** toggle in the top-right of the connection bar.

## What's in debug mode

### Live cube view

- **ControlBar** — Reset gyro, reset cube state, reset center tracking (requires hardware connection)
- **FSM state row** — Shows current `sensorState` (0 = home). Updates on each move. Includes **Reset FSM to 0** button for manual testing. In normal use `resetCenterTracking` resets the FSM automatically — this button is for diagnosing gyro rendering issues.
- **CubeCanvas** — Live 3D cube rendering driven by the connected driver
- **OrientationConfig** — Set front/bottom face orientation; saved to localStorage
- **FaceletDebug** — Raw 54-sticker facelets display (text)
- **MoveHistory** — Last 100 moves received from the driver

### Cloud Sync (Firebase) panel

Shows current auth state. When **not signed in**:
- **Sign in with Google** — triggers Firebase Google auth

When **signed in**:
- Signed-in email display
- **Enable cloud sync** checkbox — toggles Firestore sync on/off (persisted to localStorage)
- **Sign out**
- **Recalibrate solve times (hw clock)** — fixes `timeMs` inflation in cloud solves caused by BLE delivery delay. Uses `moves[last].cubeTimestamp - moves[0].cubeTimestamp` as the true elapsed time. Only corrects (never inflates). Shows count of updated solves.
- **Migrate solves to v2 (fix M/E/S labels)** — migrates all Firestore solves with `schemaVersion < 2` to v2. Shows pending count before confirmation. Solves that pass the phase invariant get `movesV1` written for user review via the solve detail modal. Shows migrated/failed counts on completion.

### Maintenance buttons (bottom toolbar)

- **Refresh solves** — re-reads solves from Firestore (cloud mode only). Button disabled when cloud sync is off or a refresh is already in-flight. Use this to pick up changes made from another tab or device.
- **Clear recorded moves** — clears the in-memory move list shown in MoveHistory (does not affect saved solves)
- **Clear localStorage** — wipes all local data (solves, settings, everything); reloads
- **Restore example solves** — un-dismisses the built-in example solves; reloads
- **Recalibrate solve times (hw clock)** — same recalibration as the cloud button, but for localStorage solves only
- **Detect method mismatches (Firestore | localStorage)** — scans solves and flags ones where the stored method likely disagrees with the actual solving technique used. Targets Firestore when cloud sync is enabled and signed in, otherwise localStorage. Label updates dynamically. See below.
- **Import from acubemy** — opens the `AcubemyImportModal` to bulk-import acubemy JSON exports. See `docs/import-data.md` for the full flow.
- **Recompute phases (Firestore | localStorage)** — inline `<RecomputePhasesPanel>` that scans all solves from the active store, recomputes `phases` using the current `isDone` predicates, shows a dry-run summary (unchanged / changed / failed / skipped counts + a small inline legend explaining each bucket, up to 5 sample changed rows filtered to those with a turn-count diff, failed ids — both sample-row and failed ids are clickable to open the solve detail modal), and commits only the changed, successfully-recomputed solves. Cancel returns to idle from the dry-run. Targets Firestore (chunked `Promise.all(setDoc)`, 100 per chunk, with `batch X of Y` progress starting at `0 of N`) when cloud sync is enabled and signed in, otherwise localStorage (single `saveToStorage` write). Label updates dynamically. See `src/utils/recomputeAllPhases.ts` and spec `docs/superpowers/specs/2026-04-20-bulk-recompute-phases-design.md`.
- **Resequence solves (Firestore)** (`ResequenceScopePanel`): Previews the scope of a `seq` renumber operation — shows total solve count, first-mismatch cursor (`#id`, date, stored seq vs. target seq), and how many rows will be renumbered. Cloud-only panel; shows disabled hint when cloud sync is off. Commit uses `bulkUpdateSolvesInFirestore` (chunks of 100) with batch progress. After commit: updates `NEXT_ID` in `localStorage`, calls `solveStore.reload()` (no page reload).

### Method mismatch detector

Triggered by **Detect method mismatches (Firestore | localStorage)** in the maintenance toolbar. Targets Firestore when cloud sync is signed in and enabled, otherwise localStorage; label updates dynamically. Scans all non-example solves and flags ones where the stored `method` field likely disagrees with the actual solving technique.

**Signals used (see `src/utils/detectMethod.ts`):**
- **M-move count ≥ 8** → suggests Roux (Roux LSE is exclusively M+U moves; CFOP rarely exceeds 4)
- **CFOP Cross > 15 turns** → Cross phase is bloated, probably not CFOP
- **Roux FB > 18 turns** → FB phase is bloated, probably not Roux
- Ambiguous cases (both or neither plausible) are skipped — no false positives

**Results table columns:**
- **Solve** — clickable ID; switches to timer mode and opens the solve detail modal where you can change the method
- **Stored** — current `method` value (red)
- **Suggested** — detected method (green)
- **M** — M-move count (highlighted orange if ≥ 8)
- **Cross** — CFOP cross turn count (highlighted red if > 20)
- **FB** — Roux FB turn count (highlighted red if > 20)

### Dev-only console handles

When running in dev mode (`npm run dev` / `import.meta.env.DEV`), `useSolveStore` exposes two globals for ad-hoc debugging in the browser DevTools console:

- **`window.__solves`** — the live `SolveRecord[]` passed to components (user solves + visible examples). Kept in sync on every store snapshot.
- **`window.__solveState`** — the full store snapshot: `{ solves, status, cloudReady, dismissedExamples, error }`. Useful for checking cloud-sync status and the raw (example-free) solve list.

Set in `src/hooks/useSolveStore.ts`, gated on `import.meta.env.DEV`, so these globals are stripped from production builds by Vite. Use them for quick inspection like `window.__solves.filter(s => s.method === undefined)` without adding UI scaffolding.

## When to update this document

Update `docs/debug-mode.md` whenever you:
- Add or remove a button or panel in the debug mode section of `App.tsx`
- Change what an existing button does
- Add new maintenance tools or Firebase operations
