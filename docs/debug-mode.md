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
- **Renumber solves (fix seq)** — reassigns sequential `seq` numbers 1..n to all Firestore solves ordered by date. Destructive, requires confirmation. Reloads the page after.
- **Recalibrate solve times (hw clock)** — fixes `timeMs` inflation in cloud solves caused by BLE delivery delay. Uses `moves[last].cubeTimestamp - moves[0].cubeTimestamp` as the true elapsed time. Only corrects (never inflates). Shows count of updated solves.
- **Migrate solves to v2 (fix M/E/S labels)** — migrates all Firestore solves with `schemaVersion < 2` to v2. Shows pending count before confirmation. Solves that pass the phase invariant get `movesV1` written for user review via the solve detail modal. Shows migrated/failed counts on completion.
- **Detect method mismatches** — same as the maintenance toolbar button, but reads from Firestore instead of localStorage.

### Maintenance buttons (bottom toolbar)

- **Clear recorded moves** — clears the in-memory move list shown in MoveHistory (does not affect saved solves)
- **Clear localStorage** — wipes all local data (solves, settings, everything); reloads
- **Restore example solves** — un-dismisses the built-in example solves; reloads
- **Recalibrate solve times (hw clock)** — same recalibration as the cloud button, but for localStorage solves only
- **Detect method mismatches** — scans localStorage solves and flags ones where the stored method likely disagrees with the actual solving technique used. See below.

### Method mismatch detector

Triggered by **Detect method mismatches** (maintenance toolbar for localStorage, cloud sync panel for Firestore). Scans all non-example solves and flags ones where the stored `method` field likely disagrees with the actual solving technique.

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

## When to update this document

Update `docs/debug-mode.md` whenever you:
- Add or remove a button or panel in the debug mode section of `App.tsx`
- Change what an existing button does
- Add new maintenance tools or Firebase operations
