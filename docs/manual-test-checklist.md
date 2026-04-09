# Manual Test Checklist

## Scramble Tracker — Wrong Mode (same face net turns)

- [ ] Turn a wrong face (e.g. U when expecting R) → hint shows U'
- [ ] Turn U again → hint changes to U2
- [ ] Turn U again → hint changes to U
- [ ] Turn U again → exits wrong mode, back to scrambling

## Scramble Tracker — Wrong Mode (direction mixing)

- [ ] Turn U (wrong) → hint U'. Turn U' → exits wrong mode (net=0)
- [ ] Turn U → U2 → back to U' → exits: U, U, U', U' sequence → exits wrong mode

## Scramble Tracker — Wrong Mode (multiple faces)

- [ ] Turn U then R → hint shows R' U' (reverse order)
- [ ] From above, turn R' → hint shows only U'. Turn U' → exits wrong mode
- [ ] Turn U, R, F → hint shows F' R' U'. Cancel one by one back to scrambling

## Scramble Tracker — Wrong Mode to Warning

- [ ] Expecting R: turn R' (enters warning). Turn U → wrong mode. Turn U' → back to **warning** (not scrambling)
- [ ] From above, accumulate U×4 in wrong mode → exits wrong mode back to **warning**

## Scramble Tracker — Normal Flow

- [ ] Complete a CW step correctly → step turns green, advances to next
- [ ] Complete a CCW step correctly (e.g. U')
- [ ] Complete a double step (U2): first turn → warning color; second same-direction turn → done
- [ ] Complete all steps in sequence → armed state (timer starts on next move)

## Trends Modal

- [ ] Click "Trends" button in the sidebar stats header → TrendsModal opens full-screen
- [ ] Click ✕ → modal closes, returns to main screen
- [ ] Method filter select (All / CFOP / Roux) → filters chart data and syncs with sidebar
- [ ] Total tab: scatter dots visible; Ao5 line appears once 5+ solves in window; Ao12 line appears once 12+ solves
- [ ] Phases tab: one line per phase (or group); lines use correct phase colors
- [ ] Exec/Recog toggle changes plotted values on both tabs
- [ ] Grp/Split toggle (Phases tab only): grouped sums F2L/OLL/PLL into single lines; split shows individual phases
- [ ] Grp/Split toggle hidden when active method has no grouped phases (e.g. Roux FB/SB/CMLL)
- [ ] Window 25/50/100/All slices the data correctly
- [ ] On mobile (< 640px): default window is 25; All option is hidden
- [ ] Click a dot (Total tab) → SolveDetailModal opens on top of TrendsModal
- [ ] Click ✕ on SolveDetailModal → returns to TrendsModal (TrendsModal still visible)
- [ ] Click ✕ on TrendsModal → both modals close
- [ ] URL hash updates to `#trends?method=...&tab=...&window=...&group=...&timetype=...` while modal is open
- [ ] Paste a `#trends?...` URL → modal opens with correct tab/window/group/timetype restored
- [ ] Cloud sync ON: paste a `#trends?...` URL → modal opens after solves load (not blank)
- [ ] Paste a `#solve-N` URL with cloud sync ON → SolveDetailModal opens after solves load

## Scramble Tracker — Warning Mode (wrong direction on correct face)

- [ ] Expecting R: turn R' → warning. Turn R → cancels back to scrambling (net=0)
- [ ] Expecting R: turn R' three times → fulfills step (3× CCW ≡ +1 mod 4)
- [ ] Expecting U2: turn U → warning. Turn U again → done (net=2)
- [ ] Expecting U2: turn U → warning. Turn U' → back to scrambling (net=0)
