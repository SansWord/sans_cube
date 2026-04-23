# Manual Test Checklist

---

## 1. Connection

- [ ] Click **Connect** → browser Bluetooth picker appears
- [ ] Select GAN cube → status shows "connected", battery % shown
- [ ] Rotate the physical cube → 3D cube on screen updates in real time
- [ ] Click **Disconnect** → status shows "disconnected"
- [ ] Click **[debug]** toggle → switches to debug mode; click **[timer]** → back to timer mode

---

## 2. Core Timer Flow

### 2a. Basic solve

- [ ] After connecting, complete the scramble (follow ScrambleDisplay steps) → cube arms (ready state)
- [ ] Make first move → timer starts
- [ ] Continue solving → timer runs
- [ ] Complete the solve (cube reaches solved state) → timer stops, solve saved to history sidebar

### 2b. Phase bar

- [ ] During/after a solve, PhaseBar shows segments for each CFOP phase (Cross, F2L, OLL, PLL)
- [ ] Each segment length is proportional to time spent
- [ ] Hovering a segment shows the phase label and time

### 2c. Scramble regeneration

- [ ] Click **↺** (regenerate) on ScrambleDisplay → new scramble generated
- [ ] After a solve completes, a new scramble auto-generates

### 2d. Method selector

- [ ] Switch method to **Roux** → PhaseBar changes to Roux phases (FB, SB, CMLL, LSE)
- [ ] Switch back to **CFOP** → PhaseBar restores CFOP phases

---

## 3. Solve History Sidebar

### 3a. Stats

- [ ] Sidebar shows Single / Ao5 / Ao12 / Ao100 with Current + Best columns
- [ ] After adding solves, Ao5 populates once 5 solves exist; Ao12 once 12 exist
- [ ] Best column highlights in green

### 3b. Solve list

- [ ] Solve list shows most recent solve at top, oldest at bottom
- [ ] Each row shows: solve number, time, TPS, method
- [ ] Example solves (★) shown before real solves

### 3c. Interactions

- [ ] Click a solve row → SolveDetailModal opens
- [ ] Drag the sidebar edge → sidebar resizes (min ~120px, max ~320px); font scales
- [ ] Method filter dropdown (**All / CFOP / Roux**) → stats and list update to match filter

### 3d. Copy button

- [ ] Click **copy** next to "Last Solves" → button shows "✓ copied" briefly
- [ ] Paste into a spreadsheet → tab-separated columns (seq, time, TPS, method, phases)

### 3e. Mobile overlay

- [ ] On narrow viewport (< ~640px): sidebar becomes a floating button; tap it → full-screen overlay opens
- [ ] Tap **✕** → overlay closes

---

## 4. Solve Detail Modal

### 4a. Display

- [ ] Modal shows: solve time, move count, date/time
- [ ] PhaseBar shows phase breakdown with times
- [ ] Move list scrolls if long

### 4b. Replay

- [ ] Click **▶** → replay starts; 3D cube animates moves
- [ ] Click **⏸** → replay pauses
- [ ] Click **⏭** / **⏮** → fast-forward / rewind
- [ ] Click **›** / **‹** → step forward / backward one move
- [ ] Speed control changes playback speed
- [ ] Phase indicator on PhaseBar tracks current replay position
- [ ] Gyro toggle: enabling shows orientation animation during replay

### 4c. Close and delete

- [ ] Click **✕** → modal closes, returns to timer screen (or TrendsModal if opened from there)
- [ ] Delete button → solve removed from history; modal closes

### 4d. URL deep link

- [ ] While modal open, URL updates to `#solve-N`
- [ ] Paste `#solve-N` URL → modal opens on that solve (after page load)
- [ ] With cloud sync ON: paste `#solve-N` → modal opens after solves load (not blank)

### 4e. Import badge

- [ ] Open an imported solve (one with `importedFrom` set, e.g. an acubemy-imported solve) → pill reads "Imported from acubemy" next to the `Solve #N` title
- [ ] Open a natively-recorded solve → no Imported pill
- [ ] Open the example solve → no Imported pill (LinkedIn "Built by SansWord" pill on the right side is unchanged)
- [ ] Open a shared imported solve via `#shared-{shareId}` → pill still renders in read-only mode

---

## 5. Cloud Sync (Firebase)

- [ ] Switch to debug mode → Cloud Sync panel shows "not signed in"
- [ ] Click **Sign in with Google** → Google auth flow, returns signed in
- [ ] Check **Enable cloud sync** → sidebar shows loading spinner, then solves load from cloud
- [ ] Add a solve → appears in cloud (verify by reloading)
- [ ] Uncheck cloud sync → returns to local solves (cloud solves no longer shown)
- [ ] Click **Sign out** → signed out; cloud sync disabled

---

## 6. Scramble Tracker — Normal Flow

- [ ] Complete a CW step correctly → step turns green, advances to next
- [ ] Complete a CCW step correctly (e.g. U')
- [ ] Complete a double step (U2): first turn → warning color; second same-direction turn → done
- [ ] Complete all steps → armed state (timer starts on next move)

---

## 7. Scramble Tracker — Warning Mode (wrong direction)

- [ ] Expecting R: turn R' → warning. Turn R → cancels back to scrambling (net=0)
- [ ] Expecting R: turn R' three times → fulfills step (3× CCW ≡ +1 mod 4)
- [ ] Expecting U2: turn U → warning. Turn U again → done (net=2)
- [ ] Expecting U2: turn U → warning. Turn U' → back to scrambling (net=0)

---

## 8. Scramble Tracker — Wrong Mode (same face net turns)

- [ ] Turn a wrong face (e.g. U when expecting R) → hint shows U'
- [ ] Turn U again → hint changes to U2
- [ ] Turn U again → hint changes to U
- [ ] Turn U again → exits wrong mode, back to scrambling

---

## 9. Scramble Tracker — Wrong Mode (direction mixing)

- [ ] Turn U (wrong) → hint U'. Turn U' → exits wrong mode (net=0)
- [ ] Turn U → U2 → back to U' → exits: U, U, U', U' sequence → exits wrong mode

---

## 10. Scramble Tracker — Wrong Mode (multiple faces)

- [ ] Turn U then R → hint shows R' U' (reverse order)
- [ ] From above, turn R' → hint shows only U'. Turn U' → exits wrong mode
- [ ] Turn U, R, F → hint shows F' R' U'. Cancel one by one back to scrambling

---

## 11. Scramble Tracker — Wrong Mode to Warning

- [ ] Expecting R: turn R' (enters warning). Turn U → wrong mode. Turn U' → back to **warning** (not scrambling)
- [ ] From above, accumulate U×4 in wrong mode → exits wrong mode back to **warning**

---

## 12. Trends Modal

- [ ] Click **Trends** button in sidebar stats header → TrendsModal opens
- [ ] Click **✕** → modal closes
- [ ] Method filter (All / CFOP / Roux) → filters chart data and syncs with sidebar
- [ ] **Total tab**: scatter dots visible; Ao5 line appears once 5+ solves in window; Ao12 once 12+
- [ ] **Phases tab**: one line per phase (or group); lines use correct phase colors
- [ ] Exec/Recog/Total toggle changes plotted values on both tabs
- [ ] **Grp/Split** toggle (Phases tab): grouped sums F2L-a/F2L-b into one line; split shows individual
- [ ] Grp/Split toggle hidden when method has no grouped phases (e.g. Roux)
- [ ] Window **25/50/100/All** slices the data correctly
- [ ] On mobile (< 640px): default window is 25; All option is hidden
- [ ] Click a dot (Total tab) → SolveDetailModal opens on top of TrendsModal
- [ ] Click **✕** on SolveDetailModal → returns to TrendsModal (TrendsModal still visible)
- [ ] Click **✕** on TrendsModal → both modals close
- [ ] URL hash updates to `#trends?tab=...&window=...&group=...&timetype=...` while open
- [ ] Paste a `#trends?...` URL → modal opens with tab/window/group/timetype restored
- [ ] Cloud sync ON: paste `#trends?...` URL → modal opens after solves load (not blank)

---

## 13. Solve Sharing

- [ ] Open a solve → click **Share** → button shows loading, then a share URL appears
- [ ] Copy the share URL → open in a new tab → shared solve loads in read-only modal
- [ ] Shared solve row in sidebar shows seq number in green
- [ ] Click **Unshare** → share link deactivated (opening old URL shows "not found")
- [ ] Open `#shared-{shareId}` URL directly → solve loads; URL preserved in address bar after load
- [ ] Open invalid `#shared-xxxxx` URL → brief "not found" message, then clears

---

## 14. Analytics

**Setup:** Open Firebase Console → Analytics → DebugView before testing.

- [ ] Open the site → `page_view` event appears in DebugView
- [ ] Open `#shared-{shareId}` URL → `shared_solve_viewed` event with `share_id` param
- [ ] Make any cube move (first move of the session) → `cube_first_move` with `driver: mouse` (or `touch` on mobile)
- [ ] Complete a solve → `solve_recorded` with `method` param
- [ ] Connect GAN cube → `cube_connected` event
- [ ] Make first move with GAN cube → `cube_first_move` with `driver: ble`
- [ ] Enable cloud sync → `cloud_sync_enabled` event
- [ ] Share a solve → `solve_shared` event with `method` param
- [ ] Sign in → analytics user ID set (check DebugView user property)
- [ ] Sign out → analytics user ID cleared
- [ ] First visit: analytics banner appears at bottom
- [ ] Click **Got it** → banner disappears; does not reappear on reload

---

## 15. Debug Mode

- [ ] Switch to debug mode → 3D cube canvas shows, ControlBar and OrientationConfig visible
- [ ] **Reset gyro** → cube 3D orientation resets to neutral
- [ ] **Reset cube state** → cube facelets reset to solved state (requires hardware)
- [ ] **OrientationConfig**: set front face to green, bottom to yellow → save → reconnect → orientation preserved
- [ ] **FaceletDebug** → shows 54-character facelets string matching physical cube state
- [ ] **MoveHistory** → shows last N moves as they come in
- [ ] **Recalibrate solve times (hw clock)** (localStorage) → shows count of corrected solves
- [ ] **Recalibrate solve times (hw clock)** (cloud, if signed in) → same, for Firestore solves
- [ ] **Clear localStorage** → confirmation; on confirm, all local data wiped and page reloads
- [ ] **Restore example solves** → example solves reappear in sidebar after reload

---

## 16. Solve Store — cache and refresh

- [ ] With cloud sync ON, open DevTools Network tab filtered to `firestore.googleapis.com`.
- [ ] Reload the page → observe exactly **one** `loadSolves`-style read on boot.
- [ ] Toggle `[timer]` → `[debug]` → `[timer]` → **zero** additional reads.
- [ ] In debug mode, click **Detect method mismatches** → **zero** additional reads.
- [ ] In debug mode, click **Import from acubemy** → modal opens; **zero** additional reads to populate `existingSolves`.
- [ ] Import 250 solves via acubemy → progress indicator runs; 3 chunked rounds of writes; state updates to reflect new rows.
- [ ] Run **Recompute phases** → debug panel shows updated phase labels without a manual refresh.
- [ ] Click **Refresh solves** in debug → one additional `loadSolves` read; button briefly disabled.
- [ ] Sign out mid-session → `solves` list reverts to the localStorage view.
