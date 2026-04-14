# Dev Log — sans_cube

A record of what was built and what was learned, especially around co-working with Claude Code.

## TL;DR

| Version | What shipped |
|---|---|
| v1.13 | Extract `useSharedSolve` hook; fix spinner stuck on Firestore error; show "not found" for invalid share IDs |
| v1.12 | Code quality sweep + bug fixes — useCubeDriverEvent hook, CubieData WeakMap, phase merge helper, method-change armed state |
| v1.11 | Firebase Analytics — page views, solve events, shared-solve views, driver tracking, consent banner |
| v1.10 | Solve sharing — capability URLs, public Firestore doc, read-only viewer modal |
| v1.9 | Debug tool — detect CFOP/Roux method mismatches across solve history |
| v1.8 | Method update in SolveDetailModal — CFOP ↔ Roux with recomputePhases |
| v1.7 | URL deep link fixes — `#solve-N`, `#trends`, hashchange listener, loading overlay |
| v1.6 | Hardware clock timing fix — BLE delay correction, recalibration buttons, copy-as-TSV |
| v1.5 | Stats Trends modal — scatter + phase lines, Ao5/Ao12, zoom, day lines, URL sync |
| v1.4 | Method filter in solve history sidebar |
| v1.3 | Firebase cloud sync — opt-in Google sign-in, Firestore storage, GitHub Pages deploy |
| v1.2 | Mobile layout, polish |
| v1.1 | Roux method + slice moves |
| v1.0 | Scramble tracker, timer, solve history |
| v0.4 | Example solves, button driver |
| v0.3 | Replay + phase highlighting |
| v0.2 | Layout + sidebar |
| v0.1 | Foundation — BLE connection, 3D cube, move recording |

---

### Learning tags

| Tag | Meaning |
|-----|---------|
| `[note]` | Useful context, well-documented — good to have written down but you'd find it in the docs |
| `[insight]` | Non-obvious; meaningfully changes how you design or debug something |
| `[gotcha]` | A specific trap that bit you; high risk of biting you again — bookmark this |

---

## v1.13 — useSharedSolve extraction + shared link bug fixes (2026-04-14 01:36)
**Review:** not yet

**What was built:**
- **`useSharedSolve` hook** (`src/hooks/useSharedSolve.ts`): extracted 3 state fields (`sharedSolve`, `sharedSolveLoading`, `sharedSolveNotFound`) and both fetch effects (boot + hashchange) from `TimerScreen`. Returns `clearSharedSolve()` which clears state and resets the URL hash. Reduces `TimerScreen` from 10 to 7 `useState` declarations.
- **Fix: Firestore error no longer leaves spinner frozen** — `.catch(() => null)` added to `loadSharedSolve(shareId)` in the `Promise.race`. Previously, any Firestore rejection (network error, permissions, ad blocker in incognito) would reject the race silently, leaving `sharedSolveLoading = true` forever with no "not found" feedback.
- **Fix: invalid-format share IDs now show "not found" banner** — previously `#shared-notavalidid` (fails the 20-char regex) silently did nothing. Now `doLoad` calls `showNotFound()` immediately for bad-format IDs — no spinner, no Firestore fetch.
- **`showNotFound` helper** inside `useSharedSolve`: deduplicates the `setSharedSolveNotFound` + `history.replaceState` + `setTimeout` pattern used in three places.
- **Analytics call moved inside `doLoad`** with a `logAnalytics` flag — fires only on boot (not on hashchange navigation), and only after the regex check passes (not for malformed IDs).

**Key technical learnings:**
- `[gotcha]` `Promise.race` rejects if the winning promise rejects — if you don't `.catch()` the individual promises, a Firestore error can silently freeze loading state indefinitely. Always wrap individual race contestants with `.catch(() => fallback)`.
- `[insight]` Silent no-op for invalid input feels like a bug to users who landed on a `#shared-` URL — even a regex-rejected ID should give visible feedback ("not found"), just skip the spinner and the Firestore round-trip.

---

## v1.12 — Code quality sweep + bug fixes (2026-04-14 01:13)
**Review:** not yet

**What was built:**
- **`useCubeDriverEvent` hook** (`src/hooks/useCubeDriverEvent.ts`): typed wrapper for `d.on(event, fn)` / `d.off(event, fn)` cleanup. Uses a handler ref internally so the handler is always the latest version without re-registering on every render — no `useCallback` required at call sites. Used by all 7 hooks/components that previously duplicated this pattern (`useTimer`, `useCubeState`, `useSolveRecorder`, `useScrambleTracker`, `useGestureDetector`, `App.tsx`, `TimerScreen.tsx`). Also exports `EventMap` from `CubeDriver.ts` to enable typed generic over event names.
- **`absorbPhaseIntoNext` helper** in `useTimer.ts`: extracted from two near-identical EOLL→COLL and CPLL→EPLL absorption blocks (~26 lines → 2 one-liner calls).
- **`CubieData` interface + `WeakMap`** in `CubeRenderer.ts`: replaced 7 `userData as { x, y, z }` unsafe casts with a typed `WeakMap<THREE.Mesh, CubieData>`. Also fixed `animateQuaternionTo` and `animateOrbitToDefaultView` — both started uncancellable RAF loops with no stored frame ID; concurrent calls would fight each other and `dispose()` couldn't cancel them.
- **Removed dead `partialDirection` field** from `TrackerState` in `useScrambleTracker.ts` — field was set in one place and never read.
- **Fix: method change no longer exits armed mode** — `setArmed(false)` removed from `MethodSelector.onChange` in `TimerScreen`. Method only affects phase analysis, not scramble completion.
- **Fix: facelets baseline preserved on method change while armed** — `resetTimer()` was unconditionally called on method change, resetting `faceletsRef` to `SOLVED_FACELETS` even though the cube was physically scrambled. Now gated: `if (!armed) resetTimer()`.
- **Fix: PhaseBar tooltip crash on stale `hoveredIndex`** — added `hoveredIndex < phaseRecords.length` guard before the tooltip IIFE. Pre-existing bug; method switching made it easier to hit by changing phase count between solves.
- **5 new tests** for `useCubeDriverEvent`: handler fires, cleanup on unmount, re-registration on `driverVersion` change, latest-handler-without-re-registering, null driver.

**Key technical learnings:**
- `[insight]` **The handler-ref trick eliminates `useCallback` requirements at call sites.** Store `handlerRef.current = handler` on every render, register a stable wrapper `(payload) => handlerRef.current(payload)` in the effect. The wrapper never changes identity so the effect never re-runs due to handler churn. This is strictly better than requiring `useCallback` at every call site.
- `[gotcha]` **`resetTimer()` resets the facelets baseline to `SOLVED_FACELETS`.** Safe when the cube is actually solved (pre-scramble), wrong when the cube is scrambled and the user is armed. Gating on `!armed` is the correct fix — the timer's tracking starts from `SOLVED_FACELETS` at first move anyway, so no reset is needed in the armed case.
- `[gotcha]` **`hoveredIndex` in `PhaseBar` is never automatically reset when `phaseRecords` shrinks.** React component state persists across re-renders regardless of prop changes. Any index into a prop array must be bounds-checked at the access point.
- `[insight]` **WeakMap is cleaner than `userData` for typed per-object metadata in Three.js.** `userData` is `Record<string, unknown>` — every read requires an unsafe cast. A `WeakMap<THREE.Mesh, CubieData>` populated at construction time gives typed access everywhere and lets the entries be GC'd with the mesh.

---

## v1.11 — Firebase Analytics (2026-04-14 00:25)
**Review:** not yet

**Design docs:**
- Analytics: [Spec](superpowers/specs/2026-04-13-analytics-design.md) [Plan](superpowers/plans/2026-04-13-analytics.md)

**What was built:**
- **Firebase Analytics initialized** in `src/services/firebase.ts` — exports `analytics` as `Analytics | null`, guarded by `VITE_FIREBASE_MEASUREMENT_ID` env var so it's a no-op in local dev without the key set.
- **`src/services/analytics.ts`** (new): typed wrappers for all events — `logSharedSolveViewed`, `logSolveShared`, `logSolveRecorded`, `logCubeConnected`, `logCubeFirstMove`, `logCloudSyncEnabled`, `setAnalyticsUser`. Every function guards `if (!analytics) return`.
- **`AnalyticsBanner`** (new): fixed bottom bar, one-time dismiss, stored in `localStorage` under `sans_cube_analytics_acknowledged`.
- **User identity**: `setAnalyticsUser(uid)` called in `useCloudSync` on auth state change — links events across devices for signed-in users.
- **Events wired**: `shared_solve_viewed` (boot effect), `solve_recorded` (solve complete), `solve_shared` (after share succeeds), `cube_connected` (BLE connect), `cube_first_move` (first move per page load with `driver: ble|mouse|touch`), `cloud_sync_enabled` (toggle on).
- **`cube_first_move` driver detection**: `driverType === 'cube'` → `'ble'`; else `window.matchMedia('(pointer: coarse)')` → `'touch'`; else `'mouse'`.
- **`tests/__mocks__/firebase-analytics.ts`** (new): vi.fn() stubs for `getAnalytics`, `logEvent`, `setUserId` — wired in `vite.config.ts` alias to fix 3 test suite failures.
- **`docs/analytics.md`** (new): event reference, consent banner docs, local dev and DebugView instructions.

**Key technical learnings:**
- `[gotcha]` **`getAnalytics(app)` throws at import time if the firebase stub app is not a real app instance.** Even with a null-guard on the env var, Vitest loads the real `firebase/analytics` module and its `getAnalytics` call crashes against the stub `{}` app. Fix: add `firebase/analytics` to the test alias map just like `firebase/app`, `firebase/auth`, and `firebase/firestore`.
- `[insight]` **`Analytics | null` export is the right pattern for optional Firebase services.** Guard at the service boundary (`firebase.ts`) and let every consumer be a no-op. Don't push the env-var check into every call site.
- `[note]` **Firebase Analytics is free with no usage limits.** The only Firebase costs are Firestore reads/writes (cloud sync and solve sharing). Analytics adds zero cost.
- `[note]` **DebugView shows events in real time; the Events page has a 24–48 hour delay.** Use DebugView or the Google Analytics Debugger Chrome extension for testing.

---

## v1.10 — Solve Sharing (2026-04-13 21:55)
**Review:** not yet

**Design docs:**
- Solve Sharing: [Spec](superpowers/specs/2026-04-13-solve-sharing-design.md) [Plan](superpowers/plans/2026-04-13-solve-sharing.md)

**What was built:**
- **`src/services/firestoreSharing.ts`** (new): `shareSolve`, `unshareSolve`, `updateSharedSolve`, `loadSharedSolve`, `newShareId`. Share IDs are 20-char base62 strings generated with `crypto.getRandomValues()`.
- **`SolveDetailModal` share UI**: Share button, shared URL display (read-only input + Copy button), Unshare button. Button is only shown when cloud sync is enabled. `readOnly` prop hides all action controls for viewer mode (method selector, delete, share, copy-as-example).
- **`useSolveHistory.updateSolve`**: fire-and-forget `updateSharedSolve` call when the updated solve has a `shareId` set — keeps the public copy in sync on method changes.
- **`#shared-{shareId}` hash routing in `TimerScreen`**: on boot and on `hashchange`, fetches the public solve and opens `SolveDetailModal` in read-only mode. 3-second timeout; "Solve not found or no longer shared" banner on failure. Loading overlay shown while fetch is in flight.
- **Firestore data model**: `public_solves/{shareId}` (publicly readable by ID, not listable), `users/{uid}/shared_solves/{shareId}` (empty ownership registry — `exists()` check in rules avoids storing `ownerUid` in the public doc).

**Key technical learnings:**
- `[gotcha]` **`useEffect` ordering causes URL-hash clearing before async state applies.** Effects run synchronously in definition order on mount. A URL-update effect that clears the hash fires with `sharedSolveLoading = false` even though the boot effect's `setSharedSolveLoading(true)` call is batched and hasn't taken effect yet. Fix: explicitly restore the `#shared-{shareId}` hash after the fetch resolves, rather than relying on the guard alone.
- `[gotcha]` **`request.resource.size` is not a valid Firestore rules property.** It evaluates to `null`, making `null < 200000` always `false` — silently denying all writes. Firestore enforces a 1 MB document limit at the storage layer; no explicit size check is needed in rules.
- `[insight]` **Write ordering matters for `exists()` checks in security rules.** The registry doc (`users/{uid}/shared_solves/{shareId}`) must be written before the public doc (`public_solves/{shareId}`) — the `create` rule's `exists()` check reads the registry server-side. Unshare reverses the order: delete public doc first (while registry still exists for the `delete` rule), then delete registry.
- `[gotcha]` **Wildcard user rule must cover `meta/counter`.** Explicit per-collection rules (`/users/{uid}/solves/{id}`, `/users/{uid}/shared_solves/{id}`) miss the counter doc at `users/{uid}/meta/counter`. The wildcard `match /users/{userId}/{collection}/{docId}` covers all two-segment paths under any user, including `meta/counter`.
- `[insight]` **`crypto.getRandomValues()` not `Math.random()` for capability URLs.** Share IDs are unguessable tokens — their security depends on entropy. `Math.random()` is not cryptographically secure. `crypto.getRandomValues()` gives the same API surface with proper randomness.

---

## v1.9 — Detect Method Mismatches Debug Tool (2026-04-13 21:17)
**Review:** not yet

**What was built:**
- **`detectMethod.ts`** (`src/utils/detectMethod.ts`): pure utility that scans a list of `SolveRecord`s and returns any where the stored `method` field likely doesn't match how the cube was actually solved. Uses two heuristics: M-move count (≥ 8 confidently identifies Roux, since Roux LSE is exclusively M+U) and first-phase turn count under each method (recompute via `recomputePhases` — the wrong method produces a bloated first phase). Returns `null` (ambiguous, don't flag) if both methods produce plausible first phases.
- **Debug mode: "Detect method mismatches" button (local)**: scans `localStorage` solves and shows results in an inline panel. Each flagged solve displays solve ID, stored method, suggested method, M-move count, and first-phase turns under both CFOP and Roux.
- **Debug mode: "Detect method mismatches" button (cloud)**: loads all solves from Firestore first, then runs the same heuristic. Separate button in the Firebase panel, disabled while scanning.
- **Fix flow reuses `SolveDetailModal`**: clicking a flagged solve opens it in `SolveDetailModal` with full `onUpdate`/`onDelete` wiring. After a method change, the mismatch panel re-runs `detectMethodMismatches` on just that solve — removes it from the list if fixed, updates in place if still flagged.

**Key technical learnings:**
- `[insight]` **M-move count is the strongest signal for BLE Roux solves.** Roux LSE uses only M and U moves — a typical solve has 10–20 M moves. CFOP almost never exceeds 4 M moves. Threshold ≥ 8 avoids false positives.
- `[insight]` **Recomputing under the wrong method bloats the first phase.** CFOP Cross turns and Roux FB turns each have a natural ceiling (~15 and ~18 respectively). If a solve exceeds the ceiling under method A but not method B, it's a strong signal the solve was done with method B.
- `[insight]` **Don't flag ambiguous cases.** If both methods produce a plausible first phase, `suggestMethod` returns `null` — the solve is skipped. False positives are more damaging than false negatives for a correction tool.
- `[note]` **Reusing `SolveDetailModal` for the fix flow avoids building new UI.** The modal already has `MethodSelector`, `onUpdate`, and `onDelete` — connecting it to the debug panel's `selectedDebugSolve` state was enough to make the full fix flow work.

---

## v1.8 — Method Update in SolveDetailModal (2026-04-13 19:05)
**Review:** not yet

**Design docs:**
- Method Update: [Spec](superpowers/specs/2026-04-13-method-update-design.md) [Plan](superpowers/plans/2026-04-13-method-update.md)

**What was built:**
- **Method selector in SolveDetailModal**: `MethodSelector` added to the "Detailed Analysis" header — lets the user switch a stored solve between CFOP and Roux (and any future method) without leaving the modal.
- **`recomputePhases` utility** (`src/utils/recomputePhases.ts`): pure function that replays `solve.moves` against facelets, detects phase transitions via `phase.isComplete(facelets)`, computes `recognitionMs`/`executionMs` from `cubeTimestamp` diffs, and applies CFOP merge rules (EOLL/COLL, CPLL/EPLL) matched by label — no-op for non-CFOP methods. Returns `null` if the cube is not solved after all moves.
- **`updateSolve` in `useSolveHistory`**: replaces a solve by `id` in localStorage, or calls `updateSolveInFirestore` (idempotent `setDoc`) in cloud mode.
- **Optimistic update with rollback**: `SolveDetailModal` updates `localSolve` immediately for instant UI feedback, disables the MethodSelector and Delete button while saving, and rolls back on error using a `previousSolve` capture before the optimistic update.
- **Inline error message**: `recomputePhases` returning `null` (corrupt/incomplete solve) shows a 4-second inline error — no toast component exists yet.
- **Round-trip tests** (`tests/utils/recomputePhases.test.ts`): data-provider style with `it.each` over `CFOP_SOLVES` and `ROUX_SOLVES` arrays. Verifies CFOP→Roux→CFOP and Roux→CFOP→Roux produce exactly identical `turns`, `recognitionMs`, and `executionMs`.
- **`tests/fixtures/solveFixtures.ts`**: real solve records copied from `exampleSolves.ts` with quaternion fields stripped. `CFOP_SOLVES` (2 solves) and `ROUX_SOLVES` (1 solve) — append to these arrays to expand test coverage.

**Key technical learnings:**
- `[gotcha]` **Stale closure in rollback.** Writing `setLocalSolve(localSolve)` in a `catch` block captures `localSolve` from the closure at function-definition time — it may already reflect the optimistic update. The fix: `const previousSolve = localSolve` before any state mutation, then `setLocalSolve(previousSolve)` in `catch`.
- `[insight]` **Round-trip timing is exact, not approximate.** `recomputePhases` reads raw `cubeTimestamp` integers from `solve.moves` — those never change. The same moves, replayed against the same cube states, hit the same phase boundaries every time. `toBe` (strict equality) is correct, not `toBeCloseTo`.
- `[note]` **`phase.isComplete(facelets)` is called after each move, not before.** The while-loop pattern used in `useTimer` advances through phases as each move lands — including multiple phase completions on a single move (e.g. OLL skip completes cross+F2L+OLL simultaneously).
- `[insight]` **CFOP merge rules are label-matched, making them a safe no-op for other methods.** Checking `phases[i].label === 'EOLL'` means the same merge logic can run unconditionally after any method recompute — if the labels aren't present, nothing happens.

---

## v1.7 — URL Deep Link Fixes + Cloud Sync Loading Overlay (2026-04-09 23:24)
**Review:** not yet

**Design docs:**
- URL Routing: [Spec](superpowers/specs/2026-04-06-url-autoplay-design.md)

**What was built:**
- **URL deep link fix (cloud sync)**: visiting `#solve-N` or `#trends?...` while cloud sync is loading now correctly opens the modal after solves load. Root cause: the hash-write effect (`selectedSolve` → URL) ran on initial mount and called `history.replaceState` to clear the hash — before the resolve effect could read it. Fix: gate the hash-write effect on `urlResolvedRef.current` so it does nothing until after the initial URL has been resolved.
- **hashchange listener**: after initial load, user-typed URL changes (address bar, browser back/forward) now navigate the app. Typing `#solve-N` opens that solve; `#trends?...` opens TrendsModal; empty hash closes both. Uses `window.addEventListener('hashchange', ...)` re-registered whenever `solves` changes to keep a fresh reference.
- **`window.location.hash =` → `history.replaceState`**: the hash-write effect was using `window.location.hash = ...` which fires a `hashchange` event — would have looped back into the new listener. Switched to `history.replaceState` (silent URL update).
- **Cloud sync loading overlay**: when arriving at `#solve-N` or `#trends?...` with cloud sync enabled, a semi-transparent overlay blocks interaction and shows "Syncing solve from cloud…" / "Syncing trends from cloud…" until the data is ready. Implemented by capturing the initial hash in `initialHashRef` at mount and showing the overlay while `cloudLoading` is true.
- **Code deduplication**: extracted `filterSolves` to `useSolveHistory.ts` (was duplicated in `SolveHistorySidebar.tsx` and `TrendsModal.tsx`); exported `StatEntry` and `SolveStats` interfaces from `useSolveHistory.ts` (were redefined in `SolveHistorySidebar.tsx`).
- **Manual test checklist expanded**: added sections for Connection, Core Timer Flow, Solve History Sidebar, Solve Detail Modal, Cloud Sync, and Debug Mode — previously the checklist only covered Scramble Tracker and Trends.

**Key technical learnings:**
- `[note]` **`useEffect` runs on initial mount unconditionally.** A hash-write effect with no guard will fire on first render — even before any async data loads. If that effect clears the URL when state is empty, it wipes the hash that a later effect was meant to read. Always gate side effects that touch the URL on a "resolved" flag.
- `[gotcha]` **`window.location.hash =` fires `hashchange`; `history.replaceState` does not.** When adding a `hashchange` listener, any code that writes the hash via `window.location.hash =` will trigger its own listener. Use `history.replaceState` for programmatic URL updates to avoid the loop.
- `[insight]` **Capturing initial hash in a ref at mount is the safest pattern.** `window.location.hash` read inside a `useEffect` may be stale if another effect already cleared it. A ref initialized with `useRef(window.location.hash)` captures the value synchronously before any effects run.
- `[insight]` **A single `hashchange` listener replaces repeated "resolve on load" logic.** Rather than multiple effects each trying to read the URL at different lifecycle moments, one listener handles all post-load navigation uniformly.

---

## v1.6 — Hardware Clock Timing Fix + Solve List Copy (2026-04-09 22:40)
**Review:** not yet

**What was built:**
- **Hardware clock timing fix** (`useTimer`): all solve and phase timing now uses `cubeTimestamp + hwOffset` instead of `Date.now()`. Eliminates ~1s inflation on Roux solves where the final M/M' arrives late via the `SliceMoveDetector` retro BLE path. Both normal and `replacePreviousMove` paths fixed.
- **Per-solve hwOffset calibration**: `hwOffset = Date.now() - move.cubeTimestamp` computed on the first move of each solve — self-contained, resets drift each solve, no hardware clock query needed at connect time.
- **Retroactive recalibration**: `recalibrateSolveTimes()` utility recomputes `timeMs` from stored `moves[].cubeTimestamp` spans. Available as debug mode buttons for both localStorage and Firestore solves.
- **Example solve timeMs corrected**: id=-2 (−217ms), id=-3 (−340ms).
- **Copy solve list button**: "copy" button next to "Last Solves" copies #, Time, TPS, Method as TSV — paste-ready for spreadsheets or notes. Disabled while cloud solves are loading.
- **Sidebar scroll fix**: page no longer scrolls vertically; solve list scrolls internally with a sticky `# Time TPS Method` header. Fixed by proper flex height chain: `height: 100vh` + `overflow: hidden` at App root → `flex: 1 / minHeight: 0` at TimerScreen → `height: 100%` at sidebar wrapper → `flex: 1 / overflow-y: auto / minHeight: 0` at scroll container.
- `docs/debug-mode.md` added to document all debug mode tools and buttons.

**Key technical learnings:**
- `[insight]` **BLE delivery time ≠ move timestamp.** `cubeTimestamp` records when the physical move happened on the hardware clock. BLE can deliver the event 1+ second later. `Date.now()` at arrival inflates solve times — always prefer `cubeTimestamp + hwOffset`.
- `[gotcha]` **`minHeight: 0` is required on flex scroll containers.** Flex items default to `min-height: auto`, which prevents overflow from engaging. Without it, `overflow-y: auto` does nothing — the child just grows past the viewport.
- `[note]` **`height: 100vh` on a sidebar that starts below the top of the page causes overflow.** The sidebar was below `ConnectionBar`, so `100vh` overflowed by ConnectionBar's height. The fix is `height: 100%` — fill the flex parent, not the full viewport.
- `[note]` **Sticky `<thead>` works inside `overflow-y: auto` in Chromium.** `position: sticky; top: 0` on `<thead>` within a scrolling `<div>` works correctly — no wrapper gymnastics needed.

---

## v1.52 — Hardware Clock Timing Fix (2026-04-09 22:21)
**Review:** not yet

**What was built:**
- `useTimer` now uses `cubeTimestamp + hwOffset` instead of `Date.now()` for all timing
- On the first move of each solve, `hwOffset = Date.now() - move.cubeTimestamp` is calibrated once
- Fixes `timeMs`, `executionMs`, and `recognitionMs` — all phase timing is now hardware-accurate
- Specifically fixes the ~1s inflation on Roux solves where the final M/M' arrives via the retro BLE path in `SliceMoveDetector`
- Two new tests in `tests/hooks/useTimer.test.ts` verifying both the normal path and the `replacePreviousMove` path
- `recalibrateSolveTimes()` utility to retroactively fix stored solve records from `moves[].cubeTimestamp`
- Debug mode buttons for recalibrating both localStorage and Firestore solves
- Fixed `exampleSolves.ts` timeMs for id=-2 (−217ms) and id=-3 (−340ms)
- `docs/debug-mode.md` added to document all debug mode tools

**Key technical learnings:**
- `[insight]` **BLE delivery delay ≠ move timestamp.** The GAN cube records `cubeTimestamp` when the physical move happens. BLE can deliver that event 1+ second later. `Date.now()` at event arrival was inflating solve times. The fix is to trust the hardware timestamp, not the delivery time.
- `[insight]` **Per-solve calibration is cleaner than querying hardware clock at connect time.** Calibrating `hwOffset` on the first move is simpler, self-contained, and resets drift each solve. No need to send a hardware time request at connection.
- `[note]` **The retro M-move path needs the same fix.** `SliceMoveDetector` emits `replacePreviousMove` when the second half of a slice arrives late. `onReplacePreviousMove` in `useTimer` also had `Date.now()` — same fix applies there.
- `[note]` **`ButtonDriver`/`MouseDriver` are unaffected.** They set `cubeTimestamp = Date.now()`, so `hwOffset ≈ 0` — behavior unchanged for non-hardware drivers.
- `[insight]` **Retroactive fix is possible without re-simulation.** Stored `moves[].cubeTimestamp` spans give the true `timeMs` directly. Phase timing could also be recalculated using `phase.turns` to attribute move indices, but `timeMs` was the priority.
- `[insight]` **One-time migration as a debug button beats a localStorage flag.** No startup overhead, no extra key, user controls when it runs. Good pattern for infrequent data migrations that don't need to be automatic.

---

## v1.51 — Stats Trends Polish (2026-04-09 14:01)
**Review:** not yet

**Design docs:**
- Stats Trends: [Spec](superpowers/specs/2026-04-09-stats-trends-design.md) [Plan](superpowers/plans/2026-04-09-stats-trends.md)

**What was built:**
- **Click-to-detail fixed**: root cause was Recharts `onMouseMove` at chart level never populates `activePayload` — only the custom Tooltip component receives it. Fix: update `hoveredSolveIdRef` inside the tooltip render function; `handleChartClick` reads from the ref
- **Tooltip shows correct solve number**: was showing windowed index (`d.seq = 1,2,3…`); now shows actual `solve.seq` via `solveMap`
- **Esc chain**: TrendsModal closes on Esc only when SolveDetailModal is not open (`detailOpen` prop); full chain: detail → trends → timer
- **Semi-transparent overlay**: `rgba(10,10,26,0.88)` + `backdropFilter: blur(2px)` so cube shows through
- **Phases tab multi-toggle**: Total / Exec / Recog independently toggleable; Total=solid, Exec=`5 3` dash, Recog=`2 3` dash; phase colors preserved
- **Default time type**: both tabs default to Total only
- **Default window**: both tabs default to All (mobile still 25)

**Key technical learnings:**
- `[gotcha]` **Recharts `onMouseMove` does not populate `activePayload` at chart level.** Only the `Tooltip` component receives the correct payload via internal context. Tracking hover state must happen inside the custom tooltip render, not in `onMouseMove`.
- `[insight]` **Multiple `window.addEventListener` handlers fire simultaneously** — `stopPropagation` has no effect between them. Guard with a prop (`detailOpen`) to let the lower modal yield to the upper one.
- `[note]` **Windowed index ≠ solve sequence number.** `buildTotalData` / `buildPhaseData` assigns `seq: i + 1` as the x-axis position within the current window — not the real solve number. Always use `solveMap.get(solveId).seq` for display.

**Process learnings:**
- `[insight]` **Add console.log before trying another fix.** The click-to-detail bug went through three fix attempts before we added logging. The log immediately revealed `hasPayload: false` in `onClick` and `activePayload: undefined` in `onMouseMove` — two distinct root causes that no amount of guessing would have found. Systematic debugging (Phase 1 evidence gathering) would have saved two cycles.
- `[gotcha]` **When a Recharts event handler "should" have data but doesn't, suspect internal context.** Recharts distributes chart state through React context, not through every callback. `Tooltip` is a privileged consumer; chart-level handlers are not. Check the Recharts source or add logging before assuming an event should carry payload.
- `[insight]` **Refs across event sequences don't need state.** `didZoomRef` and `hoveredSolveIdRef` both needed to survive from one event (mousedown/mousemove) to a later one (click) without triggering re-renders in between. Refs are the right tool — state would reset the value by re-rendering before the click handler reads it.

---

## v1.5 — Stats Trends Enhancements (2026-04-09 14:01)
**Review:** not yet

**Design docs:**
- Stats Trends: [Spec](superpowers/specs/2026-04-09-stats-trends-design.md) [Plan](superpowers/plans/2026-04-09-stats-trends.md)

**What was built:**
- **Total tab multi-toggle**: Total / Exec / Recog independently toggleable; all three on by default; ao5/ao12 per type
- **Phase hiding**: click legend label to show/hide individual phase lines
- **Split color variants**: sub-phases within a group get HSL lightness variants derived from the base phase color
- **Range zoom**: drag to select range, committed to a `zoomStack`; ← Back (one level) and Reset zoom (clear all); both visible whenever `zoomStack.length >= 1`; drag threshold of ≥2 seq units to avoid trackpad false positives
- **Out-of-range fix**: pre-filter `visibleTotalData`/`visiblePhaseData` to current domain — Recharts `domain` prop only scales the axis, it does not remove data points
- **X-axis domain padding**: `[firstVisSeq - 0.5, lastVisSeq + 0.5]` prevents blank left section on small zoomed ranges
- **Day reference lines**: day-boundary `ReferenceLine` at start of each day (browser timezone); `#4a6080` color, `6 3` dash; labels show `M/D`; top margin increased to 24 to prevent label clip
- **Datetime in tooltips**: both Total and Phase tooltips show `YYYY/MM/DD HH:MM:SS` (browser timezone)
- **Click-to-detail**: clicking near a hovered dot opens SolveDetailModal; tooltip `seq` label now shows actual `solve.seq`, not windowed index
- **Disable while cloud loading**: Trends button and method filter select both disabled when `cloudLoading` is true; non-cloud users unaffected (`cloudLoading` undefined)
- **Esc to close**: TrendsModal closes on Esc unless SolveDetailModal is on top (`detailOpen` prop); Esc chain: detail → trends → timer
- **Semi-transparent background**: `rgba(10,10,26,0.88)` with `backdropFilter: blur(2px)` so the cube shows through

**Key technical learnings:**

- `[gotcha]` **Recharts `onMouseMove` at chart level does not provide `activePayload`.** The chart-level event (`CategoricalChartState`) shows `activeLabel` and `activeCoordinate` but `activePayload` is always undefined. The `Tooltip` component receives the correct payload via internal context. Fix: update `hoveredSolveIdRef` inside the custom tooltip render function (where `payload` is always available), rather than in `onMouseMove`.

- `[gotcha]` **Recharts `onClick` also never has `activePayload`** (confirmed in prior session). The ref approach captures the solveId during tooltip render; the click handler reads from the ref.

- `[insight]` **`didZoomRef` vs. state for drag/click disambiguation.** Using a state variable to track "a zoom just happened" causes a re-render between mouseUp and click, resetting the flag before the click handler reads it. A ref holds the value across the event sequence without triggering re-renders.

- `[insight]` **Multiple `window.addEventListener('keydown')` handlers all fire simultaneously.** `stopPropagation` on a `window` listener does not prevent other `window` listeners from firing. Fix: pass `detailOpen` prop to TrendsModal and guard its Esc handler with `!detailOpen`.

**Process learnings:**
- `[note]` Systematic debugging (console.log tracing) revealed the root cause in two iterations: first confirmed `activePayload` is absent in `onMouseMove`; second confirmed it's also absent in `onClick`; then found the Tooltip component as the reliable source of truth
- `[insight]` Zoom UX required careful state design: zoom stack (not a simple on/off), pre-filtered data (not just axis domain), and drag threshold (not just any movement)

---

## v1.5 — Stats Trends Initial Implementation (2026-04-09 05:18)
**Review:** not yet

**Design docs:**
- Stats Trends: [Spec](superpowers/specs/2026-04-09-stats-trends-design.md) [Plan](superpowers/plans/2026-04-09-stats-trends.md)

**What was built:**
- `src/utils/trends.ts` — pure `buildTotalData` / `buildPhaseData` functions with trimmed rolling Ao5/Ao12; fully unit-tested (21 tests, TDD)
- `src/components/TrendsModal.tsx` — full-screen fixed overlay with Total tab (scatter dots + Ao5/Ao12 lines) and Phases tab (one line per phase/group); Exec/Recog time type toggle; Group/Split toggle; window size selector (25/50/100/All); URL hash sync
- `src/components/TimerScreen.tsx` — lifted `methodFilter` state; added `showTrends`; fixed URL cloud timing bug (deferred hash resolution until cloud data loads)
- `src/components/SolveHistorySidebar.tsx` — added "Trends" button to stats header; `methodFilter` now a controlled prop from `TimerScreen`

**Key technical learnings:**

- `[gotcha]` **`<Scatter>` inside `<ComposedChart>` does not reliably use the chart's top-level `data` prop.** Using `dataKey="value"` alone produces invisible dots. Either pass `data={...}` directly to `<Scatter>`, or use a `<Line stroke="none" dot={...}>` — the Line approach is simpler and definitely works.

- `[insight]` **zIndex layering for stacked overlays needs a clear hierarchy.** When SolveDetailModal (zIndex 100) needed to appear on top of TrendsModal (zIndex 200), it rendered behind. Fixed by bumping SolveDetailModal to zIndex 300. Rule: establish the overlay z-stack explicitly when adding a new overlay.

- `[gotcha]` **State lifting + controlled props breaks tests that use interaction events.** Lifting `methodFilter` from local state to a prop means `userEvent.selectOptions` no longer causes re-renders (the mock `setMethodFilter` doesn't update state). Fix: a `SidebarWrapper` test helper that holds real state — keeps tests testing real behavior without coupling to the parent.

- `[gotcha]` **`phaseKeys` should union all data points, not just the first.** If the first solve in the window has incomplete phases, later phase keys are missing from the chart. Use `Array.from(phaseData.reduce((set, pt) => { Object.keys(pt).forEach(...) }, new Set()))`.

**Process learnings:**
- `[note]` Subagent-driven development with 7 tasks + two-stage review per task produced clean, well-reviewed code at each step
- `[note]` The plan self-review step (spec coverage + placeholder scan + type consistency check) caught the test wrapper gap before execution

---

## v1.5 — Stats Trends Design Session (2026-04-09 01:59)
**Review:** complete

**Design docs:**
- Stats Trends: [Spec](superpowers/specs/2026-04-09-stats-trends-design.md)

**What was designed:**
- Full spec for the stats trends feature — [2026-04-09-stats-trends-design.md](superpowers/specs/2026-04-09-stats-trends-design.md)
- Dedicated full-screen modal opened from a "Trends" button in the sidebar
- Two tabs: Total (scatter + Ao5/Ao12) and Phases (per-group lines)
- Time type toggle (Exec / Recog) on both tabs
- Group toggle (Grouped / Split) — groups derived from `Phase.group` field, not hardcoded
- Window toggle: 25 / 50 / 100 / All (mobile defaults to 25)
- Method filter shared/synced between sidebar and modal (lifted to TimerScreen)
- Click a chart dot → opens SolveDetailModal on top; close returns to chart
- URL encoding: `#trends?method=...&tab=...&window=...&group=...&timetype=...`

**Bug discovered — existing `#solve-<id>` URL with cloud sync:**
`selectedSolve` is initialized via a `useState` lazy initializer that calls `solves.find(id)`. When cloud sync is on, `solves` is empty at mount — Firestore hasn't returned yet. Fix: replace lazy initializer with a `useEffect` gated on `isCloudLoading`, using a `urlResolvedRef` to ensure it only fires once.

**Learnings:**
- `[note]` Recognition time (`recognitionMs`) and execution time (`executionMs`) per phase are already recorded — the trends feature doesn't need new data, just new visualization
- `[note]` Phase grouping is already encoded in the `Phase.group` field — derive from that, don't hardcode method-specific logic
- `[insight]` URL-triggered state needs to be deferred until cloud data is ready — lazy `useState` initializers run before Firestore returns

---

## Meta — Using Claude More Effectively (2026-04-08 13:30)
**Review:** not yet

### /clear reloads CLAUDE.md

`/clear` resets the conversation context but not the system prompt. CLAUDE.md is reloaded fresh at the start of every new session, including after `/clear`. This means:

- You can `/clear` freely to reclaim context window without losing any conventions or reminders
- Any instruction in CLAUDE.md is always present — you never need to repeat yourself after a clear
- Auth state, solve history, and other runtime state are unaffected by `/clear` — it only clears Claude's conversation memory

### Keep the docs list in CLAUDE.md current

CLAUDE.md has a `docs/` index. Keeping it up to date pays off because Claude reads it at session start and knows exactly which doc to open for a given topic — instead of globbing `docs/` and reading files blindly. One line added to CLAUDE.md when creating a doc saves context on every future session that touches that area.

The instruction added to CLAUDE.md: *"When creating any new `docs/*.md` file, always add it to this list with a one-line description."* This means Claude self-maintains the index going forward.

### Context window cost of CLAUDE.md entries

Adding a short instruction or doc reference to CLAUDE.md has negligible context cost. The benefit (Claude behaving correctly without prompting) always outweighs the cost of the few tokens it takes up.

---

## Meta — Using CLAUDE.md as a Process Brain (2026-04-08 13:33)
**Review:** not yet

The biggest workflow shift this session wasn't a feature — it was realising that CLAUDE.md can act as a persistent process brain that removes the need to remember conventions, reminders, and decisions across sessions.

### The problem it solves

Claude Code starts every session cold. Without CLAUDE.md, you repeat yourself:
- "remember we use Vitest not Jest"
- "don't forget to update the devlog"
- "the cube orientation is green front / yellow bottom"

With CLAUDE.md, you write it once and never say it again.

### What we put in CLAUDE.md and why

| Entry | Why it's there |
|-------|---------------|
| Who is working on this (speedcuber, GAN 12, new to web dev) | Claude adapts explanations to your level — no over-explaining BLE, no under-explaining React |
| Tech stack + Web Bluetooth caveat | Prevents Claude from suggesting Firefox-incompatible solutions |
| Key architecture (drivers, hooks, components, services) | Claude knows where to look before reading code |
| Persistence section | Prevents Claude from suggesting localStorage when Firestore is active, or vice versa |
| Doc index (`docs/`) | Claude reads only relevant docs — saves context window |
| Current State + version | Claude knows what's done and what's in progress |
| GitHub Upload Safety | A checklist Claude runs before any commit or push — secrets never slip through |
| End of Session reminder | Claude prompts you to update the devlog — you don't have to remember |

### The principle: delegate memory, not just code

Claude can hold your preferences, conventions, and reminders as reliably as code — more reliably than your own memory across sessions. Anything you've said more than once to Claude is a candidate for CLAUDE.md.

Good candidates:
- Project conventions that aren't obvious from the code
- Reminders that should happen at a specific moment ("at end of session...")
- Context that would take Claude several file reads to infer (cube orientation, who you are, what browser matters)
- Decisions already made that shouldn't be revisited ("we use Firestore, not Supabase")

Bad candidates (don't put these in CLAUDE.md):
- Things derivable from reading the code
- Temporary state or in-progress work (use tasks for that)
- Long documents (link to `docs/` instead)

### The workflow that emerged

1. **Brainstorm in conversation** — explore options, ask questions, decide together
2. **Write a plan** — locked-in spec, exact file paths, complete code, no placeholders
3. **Execute with subagents** — fresh context per task, two-stage review (spec then quality)
4. **Merge + tag** — clean history, tagged versions
5. **Update devlog** — capture learnings while fresh (CLAUDE.md reminds you)
6. **Update CLAUDE.md** — if a new convention emerged, add it so future sessions inherit it

The key insight: CLAUDE.md is not documentation for humans — it's instructions for Claude. Write it in imperative, from the project's perspective, as if briefing a contractor who just walked in.

---

## v1.4 — Method Filter in Solve History Sidebar (2026-04-08 23:05)
**Review:** not yet

**Design docs:**
- Method Filter: [Spec](superpowers/specs/2026-04-08-method-filter-design.md) [Plan](superpowers/plans/2026-04-08-method-filter.md)

**What was built:**
- Method filter dropdown (All / CFOP / Roux) in `SolveHistorySidebar`, present in both desktop sidebar and mobile overlay modes
- Stats derived locally inside the sidebar from the filtered solve pool — no longer passed as a prop from `TimerScreen`
- `useSolveHistory` no longer computes or returns `stats`; `computeStats` remains exported for direct use

**Design decisions:**
- Filter state is local `useState` inside the sidebar — no need to lift it up since nothing else consumes it
- Example solves always show regardless of filter (they're included for any method setting)
- Legacy solves with no `method` field default to `'cfop'` — consistent with the existing convention in `SolveRecord`
- Stats pool excludes examples (same as before — examples don't count toward averages)

**Learnings — TDD workflow:**
- `[note]` Writing the failing tests first (Task 1 committed before implementation) made the acceptance criteria explicit and caught the exact props contract mismatch immediately
- `[note]` The three-commit structure (failing tests → implementation → stats cleanup) produced a clean, reviewable history
- `[note]` Plan-driven execution with worktrees made the session fast: no ambiguity mid-task, isolated branch, clean merge

**Learnings — component design:**
- `[insight]` Moving stat derivation into the component that owns the filter (rather than the parent) is the right call when the parent has no use for filtered stats — prop drilling a computed value just to filter it downstream is a smell
- `[note]` Extracting `StatsSection` as an inner component kept both render paths (sidebar + overlay) DRY without over-engineering

---

## v1.3 post — Cloud Loading UX (2026-04-08 15:10)
**Review:** not yet

**What was built:**
- Loading spinner in the solve history sidebar when cloud sync is enabled and data hasn't arrived yet
- Suppresses example solves and local solves during the loading window to prevent false content flashing

**The core bug — React render cycle gap:**

When Firebase `onAuthStateChanged` resolves, it calls `setUser(user)` and `setAuthLoading(false)`. React batches these into one render. But `useEffect` runs *after* render — so there's exactly one render where:
- auth is resolved (`authLoading = false`, `user = User`)
- the Firestore loading effect hasn't started yet (`cloudLoading` is still `false`)

Any loading state that relies on an effect to turn `true` has this one-render blind spot, which appears as a brief flash of local content.

**The fix — derive loading from `cloudReady`, not `cloudLoading`:**

Instead of a `cloudLoading` state that an effect switches on, track `cloudReady` (has Firestore ever successfully returned for this uid?). Derive the loading condition purely:

```ts
const isCloudLoading = enabled && (!user || !cloudReady)
```

This stays `true` continuously from page load through auth resolution through Firestore return — no effect cycle needed to turn it on, so no gap.

**Rule of thumb:** if a loading state needs an effect to *start* it, there's a window between "condition became true" and "effect ran" where it's incorrectly false. Prefer deriving loading from "has the data arrived yet?" rather than "have I started fetching?"

---

## v1.3 — Firebase Cloud Sync (2026-04-08 13:29)
**Review:** not yet

**Design docs:**
- Firebase Cloud Sync: [Plan](superpowers/plans/2026-04-08-firebase-cloud-sync.md)

**What was built:**
- Opt-in cloud sync via Firebase Firestore, toggled from the debug section
- Google Sign-In with per-user data isolation
- One-time migration of localStorage solves to Firestore on first enable
- GitHub Actions deploy workflow for GitHub Pages

**Learnings — Firebase:**
- `[note]` Firebase web API keys are not secrets — security comes from Firestore rules, not the key
- `[note]` `authDomain` should always be the Firebase-provided domain (`*.firebaseapp.com`), not your hosted domain
- `[note]` Firebase Auth automatically whitelists `localhost` — no config needed for local dev
- `[gotcha]` Firestore rejects `undefined` values (only accepts `null`) — always sanitize objects before writing with `JSON.parse(JSON.stringify(obj))`
- `[gotcha]` `npm ci` in CI fails when `package-lock.json` was generated on macOS (Linux-specific optional native packages like `@emnapi/*` are missing) — use `npm install` instead in the workflow

**Learnings — debugging:**
- `[note]` When a Firebase popup closes immediately, check the browser console — `CONFIGURATION_NOT_FOUND` means Google sign-in provider isn't enabled in the Firebase Console (Authentication → Sign-in method → Google → Enable)
- `[gotcha]` Firestore rejects `undefined` values silently at runtime, not at compile time — TypeScript optional fields (`field?`) become `undefined`, which Firestore refuses. Fix: `JSON.parse(JSON.stringify(obj))` strips them before writing
- `[gotcha]` `npm ci` fails in CI when `package-lock.json` was generated on macOS — Linux CI adds platform-specific optional packages (`@emnapi/*`) not in the Mac-generated lock file. Fix: use `npm install` in the workflow instead

**Learnings — Firebase concepts:**
- `[note]` Firebase Auth authorized domains control which domains can trigger the OAuth popup — `localhost` is whitelisted by default, but `sansword.github.io` must be added manually for GitHub Pages
- `[note]` `authDomain` in the config should always be the Firebase-provided domain (`*.firebaseapp.com`), not the hosting domain — it's used internally for the OAuth flow, not to identify where the app lives
- `[note]` Firebase web API keys are not secrets — they're safe to expose in the browser bundle; security is enforced by Firestore rules and Auth, not the key itself
- `[note]` Firestore document sort order is determined at query time (`orderBy('date', 'asc')`) — there's no default ordering
- `[note]` UID is assigned permanently by Firebase when a user first signs in with Google — same account always gets the same UID across all devices, no management needed

**Learnings — Claude Code workflow:**
- `[note]` Subagent-driven development (brainstorm → write plan → execute with subagents + two-stage review) produced high-quality, reviewed code with no surprises
- `[note]` Subagents sometimes do more than asked (adding Firebase test stubs) when they hit a blocker — this is correct behavior, not scope creep; review the extra work before accepting
- `[note]` Discussing architecture decisions in conversation before writing the plan catches design issues cheaply (e.g. single-user vs multi-user, localStorage default vs cloud default, Firebase-only vs dual-write)
- `[note]` CLAUDE.md doc index is better than loading docs eagerly — listing docs with one-line descriptions lets Claude read only what's relevant per session
- `[note]` Asking Claude to scan git log to deduce learnings is a fast way to bootstrap a devlog retroactively

---

## v1.2 — Mobile & Polish (2026-04-06)
**Review:** not yet

**Design docs:**
- Mobile Touch: [Spec](superpowers/specs/2026-04-01-mobile-touch-design.md) [Plan](superpowers/plans/2026-04-01-mobile-touch.md)

**What was built:**
- Full mobile touch support for CubeCanvas (drag to rotate)
- Mobile layout for TimerScreen with overlay sidebar
- Sticky solve detail header and replay section on mobile
- Phase bar touch handling (tooltip stays visible after lift)
- LinkedIn and GitHub attribution links
- Various mobile CSS fixes (overflow, font size, text wrapping)

**Learnings:**
- `[note]` Mobile touch events require careful handling of `touchAction` and empty touch list guards
- `[note]` Sticky positioning inside scroll containers requires specific CSS structure
- `[note]` Small UI polish (attribution, font size, wrapping) takes more commits than expected

---

## v1.1 — Roux Method + Slice Moves (2026-04-03 to 2026-04-05)
**Review:** not yet

**Design docs:**
- Roux Method: [Spec](superpowers/specs/2026-04-07-roux-method-design.md) [Plan](superpowers/plans/2026-04-07-roux-method.md)
- Slice Moves: [Spec](superpowers/specs/2026-04-07-slice-moves-design.md) [Plan](superpowers/plans/2026-04-07-slice-moves.md)

**What was built:**
- Roux method phase detection (FB, SB, CMLL, LSE)
- Roux facelet detection utilities with tests
- Method selector dropdown, persisted to localStorage
- `SliceMoveDetector` middleware for M/E/S move detection
- Broadened `Move.face` type to include `SliceFace` and `AnyFace`
- Retroactive slice move correction with `cubeTimestamp`-gated pairing

**Learnings:**
- `[insight]` Slice moves (M/E/S) require middleware that infers the move from two sequential face moves — they're not directly reported by the GAN protocol
- `[insight]` Adding a new solve method requires: detection utils → `SolveMethod` definition → hook integration → UI selector — a clear layered pattern
- `[note]` Phase detection bugs are best caught by comparing against known solve recordings
- `[insight]` `cubeTimestamp` (hardware clock) vs wall clock distinction matters when pairing slice moves retroactively

---

## v1.0 — Scramble Tracker + Timer + Solve History (2026-03-31 to 2026-04-02)
**Review:** not yet

**Design docs:**
- Scramble Timer: [Spec](superpowers/specs/2026-03-31-scramble-timer-design.md) [Plan](superpowers/plans/2026-03-31-scramble-timer.md)
- Phase Bar Hover: [Spec](superpowers/specs/2026-04-01-phase-bar-hover-indicator-design.md) [Plan](superpowers/plans/2026-04-01-phase-bar-hover-indicator.md)

**What was built:**
- Full CFOP timer with phase detection (Cross, F2L ×4, OLL, PLL)
- Scramble tracker state machine — verifies cube matches generated scramble before starting timer
- Wrong-move cancellation hints with net-turn tracking
- Solve history sidebar with Ao5/Ao12/Ao100 statistics
- Solve detail modal with mini canvas replay and phase breakdown
- PhaseBar with hover tooltip and F2L grouping
- `useScramble`, `useScrambleTracker`, `useTimer`, `useSolveHistory` hooks
- Example solves with dismissable cards

**Learnings — architecture:**
- `[insight]` State machines are the right model for scramble verification — tracking states (idle → scrambling → armed → solving → solved) prevents edge cases
- `[insight]` Separating "recognition time" from "execution time" per phase requires careful timestamp handling
- `[insight]` Sequential solve IDs need to be persisted independently of the solve list (counter survives deletes)

**Learnings — Claude Code workflow:**
- `[note]` The brainstorm → design spec → implementation plan → execute pipeline produced a clean, well-tested feature with clear scope
- `[note]` TDD (write failing test first, then implement) caught several edge cases in `computeAo` and phase detection
- `[note]` Superpowers skills (brainstorming, writing-plans, executing-plans) provide consistent structure across sessions

---

## v0.4 — Example Solves + Button Driver (2026-03-30)
**Review:** not yet

**Design docs:**
- GAN Cube Web App: [Spec](superpowers/specs/2026-03-30-gan-cube-web-app-design.md) [Plan](superpowers/plans/2026-03-30-gan-cube-phase1.md)

**What was built:**
- Example solve records with negative IDs (won't conflict with real solves)
- Button driver for controlling a virtual cube without hardware
- Anchor URLs for solve detail modal (`#solve-<id>`)
- Replaced `cubing.js` WASM scrambler with a simpler random-move generator (removed heavy dependency)

**Learnings:**
- `[insight]` WASM dependencies (like `cubing.js`) add significant bundle size and complexity — a simple random-move generator was sufficient for the use case
- `[note]` Negative IDs for example records is a clean way to distinguish them without a separate type field

---

## v0.3 — Replay + Phase Highlighting (2026-03-28)
**Review:** not yet

**What was built:**
- Smooth gyro-interpolated replay of recorded solves
- Phase highlighting in the replay timeline
- CFOP phase grouping (F2L pairs grouped visually)
- Battery indicator with polling
- Draggable sidebar with proportional font scaling

**Learnings:**
- `[insight]` Quaternion interpolation (SLERP) is needed for smooth gyro replay — linear interpolation produces jerky rotation
- `[note]` Replay requires a separate timestamp system (`cubeTimestamp` from hardware) vs wall clock to be accurate
- `[note]` CSS `resize` for a draggable sidebar is simpler than a drag handler but less controllable

---

## v0.2 — Layout + Sidebar (2026-03-27)
**Review:** not yet

**What was built:**
- Timer/debug mode toggle
- Solve history sidebar with resizable width (persisted)
- Scramble display with per-step color coding
- Sidebar statistics (single, Ao5, Ao12, Ao100)

**Learnings:**
- `[note]` `localStorage` persistence of UI state (sidebar width, mode) makes the app feel polished with minimal effort
- `[note]` Ao calculation with trimming (drop best/worst) requires careful index handling for edge cases (n ≤ 4)

---

## v0.1 — Foundation (2026-03-25 to 2026-03-26)
**Review:** not yet

**What was built:**
- Vite + React + TypeScript scaffold
- `CubeDriver` abstract interface + `GanCubeDriver` wrapping `gan-web-bluetooth`
- `useCubeDriver`, `useCubeState`, `useGyro`, `useGestureDetector`, `useSolveRecorder` hooks
- Three.js `CubeRenderer` with layer animation
- `CubeCanvas`, `ConnectionBar`, `OrientationConfig`, `MoveHistory` components
- 2D facelet debug view
- GitHub Actions CI + GitHub Pages deploy (Node version matching was first CI lesson)

**Learnings — BLE + GAN protocol:**
- `[note]` Web Bluetooth only works in Chromium (Chrome/Edge) — not Firefox or Safari
- `[note]` GAN Gen4 protocol uses AES encryption — `gan-web-bluetooth` handles this, but the cube must be in the right mode
- `[insight]` Face sticker cycles and orientation conventions (green front / yellow bottom) must be established early — they affect everything downstream
- `[insight]` `cubeTimestamp` from hardware is separate from wall clock and drifts — important for replay accuracy

**Learnings — Claude Code workflow:**
- `[note]` Starting with a design spec (phase 1 spec) before any code gave Claude clear constraints and avoided scope creep
- `[insight]` Hooks-based architecture (`useCubeDriver`, `useCubeState`, etc.) maps well to the event-driven BLE model
- `[note]` CI failures early (Node version, `npm ci` vs `npm install`) are cheaper to fix than later
