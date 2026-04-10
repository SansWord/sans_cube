# Debug Mode

Debug mode is toggled via the **[debug]** button in `ConnectionBar`. It replaces the timer screen with a set of diagnostic and maintenance tools. It is not visible to normal users — it's accessed manually by toggling the mode.

## How to access

Click the **[debug]** / **[timer]** toggle in the top-right of the connection bar.

## What's in debug mode

### Live cube view

- **ControlBar** — Reset gyro, reset cube state (requires hardware connection)
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

### Maintenance buttons (bottom toolbar)

- **Clear localStorage** — wipes all local data (solves, settings, everything); reloads
- **Restore example solves** — un-dismisses the built-in example solves; reloads
- **Recalibrate solve times (hw clock)** — same recalibration as the cloud button, but for localStorage solves only

### Solve replayer

If a solve session was just recorded (`lastSession`), a `SolveReplayer` appears at the bottom of the debug view, allowing replay without going through the solve history sidebar.

## When to update this document

Update `docs/debug-mode.md` whenever you:
- Add or remove a button or panel in the debug mode section of `App.tsx`
- Change what an existing button does
- Add new maintenance tools or Firebase operations
