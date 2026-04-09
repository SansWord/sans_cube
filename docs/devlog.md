# Dev Log — sans_cube

A record of what was built and what was learned, especially around co-working with Claude Code.

---

## v1.9 — Stats Trends (2026-04-09)
**Review:** not yet

**What was built:**
- `src/utils/trends.ts` — pure `buildTotalData` / `buildPhaseData` functions with trimmed rolling Ao5/Ao12; fully unit-tested (19 tests, TDD)
- `src/components/TrendsModal.tsx` — full-screen fixed overlay with Total tab (scatter dots + Ao5/Ao12 lines) and Phases tab (one line per phase/group); Exec/Recog time type toggle; Group/Split toggle; window size selector (25/50/100/All); URL hash sync; dot-click → SolveDetailModal on top
- `src/components/TimerScreen.tsx` — lifted `methodFilter` state; added `showTrends`; fixed URL cloud timing bug (deferred hash resolution until cloud data loads)
- `src/components/SolveHistorySidebar.tsx` — added "Trends" button to stats header; `methodFilter` now a controlled prop from `TimerScreen`

**Key technical learnings:**

- **Recharts `activeDot.onClick` does not receive the data payload.** When you pass `activeDot={{ r: 5, onClick: fn }}`, Recharts' `adaptEventHandlers` binds the activeDot config object as the first argument — not the chart data point. The `as never` cast hides the type error. Fix: use a render function `activeDot={(props) => <circle onClick={() => use(props.payload)} />}` that closes over `props.payload`.

- **`<Scatter>` inside `<ComposedChart>` does not reliably use the chart's top-level `data` prop.** Using `dataKey="value"` alone produces invisible dots. Either pass `data={...}` directly to `<Scatter>`, or use a `<Line stroke="none" dot={...}>` — the Line approach is simpler and definitely works.

- **zIndex layering for stacked overlays needs a clear hierarchy.** When SolveDetailModal (zIndex 100) needed to appear on top of TrendsModal (zIndex 200), it rendered behind. Fixed by bumping SolveDetailModal to zIndex 300. Rule: establish the overlay z-stack explicitly when adding a new overlay.

- **State lifting + controlled props breaks tests that use interaction events.** Lifting `methodFilter` from local state to a prop means `userEvent.selectOptions` no longer causes re-renders (the mock `setMethodFilter` doesn't update state). Fix: a `SidebarWrapper` test helper that holds real state — keeps tests testing real behavior without coupling to the parent.

- **`phaseKeys` should union all data points, not just the first.** If the first solve in the window has incomplete phases, later phase keys are missing from the chart. Use `Array.from(phaseData.reduce((set, pt) => { Object.keys(pt).forEach(...) }, new Set()))`.

**Process learnings:**
- The final code review by the most capable model (opus) caught the `activeDot` and zIndex bugs that all prior reviews missed — both are easy to overlook because they're runtime-only failures with no TypeScript error
- Subagent-driven development with 7 tasks + two-stage review per task produced clean, well-reviewed code at each step; the review loops were worth it
- The plan self-review step (spec coverage + placeholder scan + type consistency check) caught the test wrapper gap before execution, saving a rework cycle

---

## Stats Trends — Design Session (2026-04-09)
**Review:** complete

**What was designed:**
- Full spec for the stats trends feature — `docs/superpowers/specs/2026-04-09-stats-trends-design.md`
- Dedicated full-screen modal opened from a "Trends" button in the sidebar
- Two tabs: Total (scatter + Ao5/Ao12) and Phases (per-group lines)
- Time type toggle (Exec / Recog) on both tabs — Total tab shows `sum(execMs)` or `sum(recogMs)`, Phases tab shows per-phase time
- Group toggle (Grouped / Split) — collapses grouped phases by default; groups derived from `Phase.group` field, not hardcoded (CFOP: F2L, OLL, PLL; Roux: LSE)
- Window toggle: 25 / 50 / 100 / All (mobile defaults to 25)
- Method filter shared/synced between sidebar and modal (lifted to TimerScreen)
- Click a chart dot → opens SolveDetailModal on top; close returns to chart
- URL encoding: `#trends?method=...&tab=...&window=...&group=...&timetype=...`

**Bug discovered — existing `#solve-<id>` URL with cloud sync:**
`selectedSolve` is initialized via a `useState` lazy initializer that calls `solves.find(id)`. When cloud sync is on, `solves` is empty at mount — Firestore hasn't returned yet. Fix: replace lazy initializer with a `useEffect` gated on `isCloudLoading`, using a `urlResolvedRef` to ensure it only fires once.

**Learnings:**
- Recognition time (`recognitionMs`) and execution time (`executionMs`) per phase are already recorded — the trends feature doesn't need new data, just new visualization
- `timeMs` (wall-clock) ≈ `sum(recogMs + execMs)` across phases — a decreasing `sum(recogMs)` trend means look-ahead is improving even before `timeMs` drops
- Phase grouping (F2L, OLL, PLL, LSE) is already encoded in the `Phase.group` field — any new feature that needs grouping should derive from that, not hardcode method-specific logic
- URL-triggered state (modal open, solve selected) needs to be deferred until cloud data is ready — lazy `useState` initializers run before Firestore returns

---

## Meta — Using Claude More Effectively (2026-04-08)
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

## Meta — Using CLAUDE.md as a Process Brain (2026-04-08)
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

## v1.4 — Method Filter in Solve History Sidebar (2026-04-08)
**Review:** not yet

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
- Writing the failing tests first (Task 1 committed before implementation) made the acceptance criteria explicit and caught the exact props contract mismatch immediately
- The three-commit structure (failing tests → implementation → stats cleanup) produced a clean, reviewable history
- Plan-driven execution with worktrees made the session fast: no ambiguity mid-task, isolated branch, clean merge

**Learnings — component design:**
- Moving stat derivation into the component that owns the filter (rather than the parent) is the right call when the parent has no use for filtered stats — prop drilling a computed value just to filter it downstream is a smell
- Extracting `StatsSection` as an inner component kept both render paths (sidebar + overlay) DRY without over-engineering

---

## v1.3 post — Cloud Loading UX (2026-04-08)
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

## v1.3 — Firebase Cloud Sync (2026-04-08)
**Review:** not yet

**What was built:**
- Opt-in cloud sync via Firebase Firestore, toggled from the debug section
- Google Sign-In with per-user data isolation
- One-time migration of localStorage solves to Firestore on first enable
- GitHub Actions deploy workflow for GitHub Pages

**Learnings — Firebase:**
- Firebase web API keys are not secrets — security comes from Firestore rules, not the key
- `authDomain` should always be the Firebase-provided domain (`*.firebaseapp.com`), not your hosted domain
- Firebase Auth automatically whitelists `localhost` — no config needed for local dev
- Firestore rejects `undefined` values (only accepts `null`) — always sanitize objects before writing with `JSON.parse(JSON.stringify(obj))`
- `npm ci` in CI fails when `package-lock.json` was generated on macOS (Linux-specific optional native packages like `@emnapi/*` are missing) — use `npm install` instead in the workflow

**Learnings — debugging:**
- When a Firebase popup closes immediately, check the browser console — `CONFIGURATION_NOT_FOUND` means Google sign-in provider isn't enabled in the Firebase Console (Authentication → Sign-in method → Google → Enable)
- Firestore rejects `undefined` values silently at runtime, not at compile time — TypeScript optional fields (`field?`) become `undefined`, which Firestore refuses. Fix: `JSON.parse(JSON.stringify(obj))` strips them before writing
- `npm ci` fails in CI when `package-lock.json` was generated on macOS — Linux CI adds platform-specific optional packages (`@emnapi/*`) not in the Mac-generated lock file. Fix: use `npm install` in the workflow instead

**Learnings — Firebase concepts:**
- Firebase Auth authorized domains control which domains can trigger the OAuth popup — `localhost` is whitelisted by default, but `sansword.github.io` must be added manually for GitHub Pages
- `authDomain` in the config should always be the Firebase-provided domain (`*.firebaseapp.com`), not the hosting domain — it's used internally for the OAuth flow, not to identify where the app lives
- Firebase web API keys are not secrets — they're safe to expose in the browser bundle; security is enforced by Firestore rules and Auth, not the key itself
- Firestore document sort order is determined at query time (`orderBy('date', 'asc')`) — there's no default ordering
- UID is assigned permanently by Firebase when a user first signs in with Google — same account always gets the same UID across all devices, no management needed

**Learnings — Claude Code workflow:**
- Subagent-driven development (brainstorm → write plan → execute with subagents + two-stage review) produced high-quality, reviewed code with no surprises
- Subagents sometimes do more than asked (adding Firebase test stubs) when they hit a blocker — this is correct behavior, not scope creep; review the extra work before accepting
- Discussing architecture decisions in conversation before writing the plan catches design issues cheaply (e.g. single-user vs multi-user, localStorage default vs cloud default, Firebase-only vs dual-write)
- CLAUDE.md doc index is better than loading docs eagerly — listing docs with one-line descriptions lets Claude read only what's relevant per session
- Asking Claude to scan git log to deduce learnings is a fast way to bootstrap a devlog retroactively

---

## v1.2 — Mobile & Polish (2026-04-06)
**Review:** not yet

**What was built:**
- Full mobile touch support for CubeCanvas (drag to rotate)
- Mobile layout for TimerScreen with overlay sidebar
- Sticky solve detail header and replay section on mobile
- Phase bar touch handling (tooltip stays visible after lift)
- LinkedIn and GitHub attribution links
- Various mobile CSS fixes (overflow, font size, text wrapping)

**Learnings:**
- Mobile touch events require careful handling of `touchAction` and empty touch list guards
- Sticky positioning inside scroll containers requires specific CSS structure
- Small UI polish (attribution, font size, wrapping) takes more commits than expected

---

## v1.1 — Roux Method + Slice Moves (2026-04-03 to 2026-04-05)
**Review:** not yet

**What was built:**
- Roux method phase detection (FB, SB, CMLL, LSE)
- Roux facelet detection utilities with tests
- Method selector dropdown, persisted to localStorage
- `SliceMoveDetector` middleware for M/E/S move detection
- Broadened `Move.face` type to include `SliceFace` and `AnyFace`
- Retroactive slice move correction with `cubeTimestamp`-gated pairing

**Learnings:**
- Slice moves (M/E/S) require middleware that infers the move from two sequential face moves — they're not directly reported by the GAN protocol
- Adding a new solve method requires: detection utils → `SolveMethod` definition → hook integration → UI selector — a clear layered pattern
- Phase detection bugs are best caught by comparing against known solve recordings
- `cubeTimestamp` (hardware clock) vs wall clock distinction matters when pairing slice moves retroactively

---

## v1.0 — Scramble Tracker + Timer + Solve History (2026-03-31 to 2026-04-02)
**Review:** not yet

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
- State machines are the right model for scramble verification — tracking states (idle → scrambling → armed → solving → solved) prevents edge cases
- Separating "recognition time" from "execution time" per phase requires careful timestamp handling
- Sequential solve IDs need to be persisted independently of the solve list (counter survives deletes)

**Learnings — Claude Code workflow:**
- The brainstorm → design spec → implementation plan → execute pipeline produced a clean, well-tested feature with clear scope
- TDD (write failing test first, then implement) caught several edge cases in `computeAo` and phase detection
- Superpowers skills (brainstorming, writing-plans, executing-plans) provide consistent structure across sessions

---

## v0.4 — Example Solves + Button Driver (2026-03-30)
**Review:** not yet

**What was built:**
- Example solve records with negative IDs (won't conflict with real solves)
- Button driver for controlling a virtual cube without hardware
- Anchor URLs for solve detail modal (`#solve-<id>`)
- Replaced `cubing.js` WASM scrambler with a simpler random-move generator (removed heavy dependency)

**Learnings:**
- WASM dependencies (like `cubing.js`) add significant bundle size and complexity — a simple random-move generator was sufficient for the use case
- Negative IDs for example records is a clean way to distinguish them without a separate type field

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
- Quaternion interpolation (SLERP) is needed for smooth gyro replay — linear interpolation produces jerky rotation
- Replay requires a separate timestamp system (`cubeTimestamp` from hardware) vs wall clock to be accurate
- CSS `resize` for a draggable sidebar is simpler than a drag handler but less controllable

---

## v0.2 — Layout + Sidebar (2026-03-27)
**Review:** not yet

**What was built:**
- Timer/debug mode toggle
- Solve history sidebar with resizable width (persisted)
- Scramble display with per-step color coding
- Sidebar statistics (single, Ao5, Ao12, Ao100)

**Learnings:**
- `localStorage` persistence of UI state (sidebar width, mode) makes the app feel polished with minimal effort
- Ao calculation with trimming (drop best/worst) requires careful index handling for edge cases (n ≤ 4)

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
- Web Bluetooth only works in Chromium (Chrome/Edge) — not Firefox or Safari
- GAN Gen4 protocol uses AES encryption — `gan-web-bluetooth` handles this, but the cube must be in the right mode
- Face sticker cycles and orientation conventions (green front / yellow bottom) must be established early — they affect everything downstream
- `cubeTimestamp` from hardware is separate from wall clock and drifts — important for replay accuracy

**Learnings — Claude Code workflow:**
- Starting with a design spec (phase 1 spec) before any code gave Claude clear constraints and avoided scope creep
- Hooks-based architecture (`useCubeDriver`, `useCubeState`, etc.) maps well to the event-driven BLE model
- CI failures early (Node version, `npm ci` vs `npm install`) are cheaper to fix than later
