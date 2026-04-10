# sans_cube

A Rubik's cube solve analyzer for speedcubers. Connects to GAN smart cubes via Web Bluetooth, records solves in real time, and breaks them down phase by phase (CFOP).

## Who is working on this

SansWord — a speedcuber who owns a GAN 12 UI Maglev. Familiar with cubing conventions (CFOP, notation, orientations like green front / yellow bottom). New to web development. Prefers guided decisions with clear options and recommendations rather than open-ended questions.

## Tech Stack

- React 19 + TypeScript + Vite
- Three.js for 3D cube rendering
- Web Bluetooth API via `gan-web-bluetooth` npm library (handles AES decryption for GAN Gen4 protocol)
- Vitest + Testing Library

**Important:** Web Bluetooth only works in Chromium-based browsers (Chrome/Edge). Keep this in mind for any browser-compatibility decisions.

## Key Architecture

See `docs/ui-architecture.md` for the full component tree, hook ownership, and data flow.

**Keep `docs/ui-architecture.md` up to date** whenever you add a component, remove a component, change which hooks a component owns, or change what props/callbacks a component exposes.

**Keep `docs/debug-mode.md` up to date** whenever you add, remove, or change a button or panel in the debug mode section of `App.tsx`.

**Drivers** (`src/drivers/`) — `CubeDriver` (abstract), `GanCubeDriver` (BLE), `MouseDriver`, `ButtonDriver`, `SliceMoveDetector`

**Services** (`src/services/`) — `firebase.ts` (app init), `firestoreSolves.ts` (Firestore CRUD)

**Hooks** (`src/hooks/`) — `useCubeDriver`, `useCubeState`, `useGyro`, `useGestureDetector`, `useSolveRecorder`, `useSolveHistory`, `useCloudSync`, `useTimer`, `useScramble`, `useScrambleTracker`, `useReplayController`, `useMethod`

**Components** (`src/components/`) — `TimerScreen`, `SolveDetailModal`, `SolveHistorySidebar`, `CubeCanvas`, `PhaseBar`, `ScrambleDisplay`, `SolveReplayer`, `ConnectionBar`, `OrientationConfig`, `TimerDisplay`, `ControlBar`, `MoveHistory`, `FaceletDebug`, `MethodSelector`

## Documentation (`docs/`)

When creating any new `docs/*.md` file, always add it to this list with a one-line description.

- `debug-mode.md` — what's in debug mode: diagnostic views, Firebase panel, maintenance buttons; update when buttons change
- `firebase-cloud-sync.md` — cloud sync architecture, security, migration behavior, ID design
- `animation-system.md` — Three.js animation details
- `manual-test-checklist.md` — manual QA checklist
- `storage.md` — all localStorage keys and Firestore structure; what syncs vs. what's local-only
- `time-model.md` — definitions of timeMs, executionMs, recognitionMs, and cubeTimestamp; how they relate
- `ui-architecture.md` — component tree, hook ownership per component, data flow, leaf component prop tables
- `trends-zoom.md` — drag-to-zoom behavior in TrendsModal: zoom stack, data filtering, x-axis domain, day reference lines

## Persistence

- Solve history: `localStorage` (default) or Firebase Firestore (opt-in, requires Google sign-in)
- Orientation config (front/bottom face): `localStorage`
- Cloud sync toggle: `localStorage` (`sans_cube_cloud_sync_enabled`)
- Full key/schema reference: `docs/storage.md`

## Development Commands

```bash
npm run dev       # start dev server
npm run build     # TypeScript check + Vite build
npm run test      # run Vitest tests
npm run lint      # ESLint
```

## Current State (as of 2026-04-09)

- **v1.6** complete — Hardware clock timing fix (BLE delay), retroactive recalibration buttons, copy solve list as TSV, sidebar scroll fix
- **v1.51** — Stats Trends polish (click-to-detail, Esc chain, phases multi-toggle)
- **v1.4** — method filter in solve history sidebar
- **v1.3** — Firebase cloud sync (opt-in), GitHub Pages deploy workflow

## Planned Future Work

See `future.md` for the full backlog (single source of truth).

## End of Session

At the end of each session, remind SansWord to update `docs/devlog.md` with learnings from the session. If he forgets, prompt him: "Want me to add today's learnings to the devlog?"

## GitHub Upload Safety

Before committing or pushing any file to GitHub, check for:
- Secrets, API keys, tokens, or passwords (hardcoded or in `.env` files)
- Private personal information beyond what's already public (name, email not intended to be public)
- Bluetooth device pairing keys or hardware identifiers
- Any file not meant to be public (e.g. `.env`, `*.pem`, `*.key`)

CLAUDE.md itself is safe to commit — it contains no secrets.
