# sans_cube

A Rubik's cube solve analyzer for speedcubers. Connects to GAN smart cubes via Web Bluetooth, records solves in real time, and breaks them down phase by phase (CFOP and Roux).

## Who is working on this

SansWord — a speedcuber who owns a GAN 12 UI Maglev. Familiar with cubing conventions (CFOP, notation, orientations like green front / yellow bottom). Growing web development skills — comfortable with React/TypeScript patterns and can follow architectural reasoning, but benefits from clear options and recommendations on design decisions rather than open-ended questions. Cares about code quality and documentation hygiene beyond just shipping features: proactively reviews for duplication, asks for code scans, and thinks about cross-project conventions.

## Tech Stack

- React 19 + TypeScript + Vite
- Three.js for 3D cube rendering
- Web Bluetooth API via `gan-web-bluetooth` npm library (handles AES decryption for GAN Gen4 protocol)
- Firebase Authentication + Firestore (opt-in cloud sync)
- Vitest + Testing Library

**Important:** Web Bluetooth only works in Chromium-based browsers (Chrome/Edge). Keep this in mind for any browser-compatibility decisions.

## Key Architecture

See `docs/ui-architecture.md` for the full component tree, hook ownership, and data flow.

**Keep `docs/ui-architecture.md` up to date** whenever you add a component, remove a component, change which hooks a component owns, or change what props/callbacks a component exposes.

**Keep `docs/debug-mode.md` up to date** whenever you add, remove, or change a button or panel in the debug mode section of `App.tsx`.

**Drivers** (`src/drivers/`) — `CubeDriver` (abstract), `GanCubeDriver` (BLE), `MouseDriver`, `ButtonDriver`, `SliceMoveDetector`

**Services** (`src/services/`) — `firebase.ts` (app init), `firestoreSolves.ts` (Firestore CRUD)

**Hooks** (`src/hooks/`) — `useCubeDriver`, `useCubeDriverEvent`, `useCubeState`, `useGyro`, `useGestureDetector`, `useSolveRecorder`, `useSolveHistory`, `useCloudSync`, `useTimer`, `useScramble`, `useScrambleTracker`, `useReplayController`, `useMethod`, `useSharedSolve`

**Components** (`src/components/`) — `TimerScreen`, `SolveDetailModal`, `SolveHistorySidebar`, `CubeCanvas`, `PhaseBar`, `ScrambleDisplay`, `ConnectionBar`, `OrientationConfig`, `TimerDisplay`, `ControlBar`, `MoveHistory`, `FaceletDebug`, `MethodSelector`

## Documentation (`docs/`)

When creating any new `docs/*.md` file, always add it to this list with a one-line description.

- [`devlog.md`](docs/devlog.md) — session-by-session record of what was built and learned; update at end of each session
- [`debug-mode.md`](docs/debug-mode.md) — what's in debug mode: diagnostic views, Firebase panel, maintenance buttons; update when buttons change
- [`firebase-cloud-sync.md`](docs/firebase-cloud-sync.md) — cloud sync architecture, security, migration behavior, ID design
- [`animation-system.md`](docs/animation-system.md) — Three.js animation details
- [`manual-test-checklist.md`](docs/manual-test-checklist.md) — manual QA checklist
- [`storage.md`](docs/storage.md) — all localStorage keys and Firestore structure; what syncs vs. what's local-only
- [`time-model.md`](docs/time-model.md) — definitions of timeMs, executionMs, recognitionMs, and cubeTimestamp; how they relate
- [`ui-architecture.md`](docs/ui-architecture.md) — component tree, hook ownership per component, data flow, leaf component prop tables
- [`trends-zoom.md`](docs/trends-zoom.md) — drag-to-zoom behavior in TrendsModal: zoom stack, data filtering, x-axis domain, day reference lines
- [`analytics.md`](docs/analytics.md) — Firebase Analytics setup, event reference, consent banner, local dev notes
- [`url-routes.md`](docs/url-routes.md) — all supported hash-based routes (`#debug`, `#solve-{id}`, `#shared-{id}`, `#trends?...`); update when routes change
- [`cube-notation.md`](docs/cube-notation.md) — cube move notation, facelets string format, face index reference, M/E/S cycle indices, GAN BLE protocol semantics

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

## Test Fixtures

Real solve records used in tests live in `tests/fixtures/solveFixtures.ts`. Quaternion fields are stripped (not needed for phase logic). To add a new test case:

1. Export a new `const MY_SOLVE: SolveRecord = { ... }` — paste a solve from the app's localStorage (`sans_cube_solves`) and strip the `quaternion` field from each move entry.
2. Append it to `CFOP_SOLVES` or `ROUX_SOLVES` at the bottom of the file.

All `it.each`-based tests in `recomputePhases.test.ts` expand automatically — no changes to the test file needed.

## Current State

See `docs/devlog.md` for the latest version and full history.

## Planned Future Work

See `future.md` for the full backlog (single source of truth).

## Promotion / Marketing Copy

When writing promotional content (LinkedIn posts, social media, release announcements):
- Do **not** mention GAN by brand name — refer to it as "smart cube" instead.

## Versioning

This project uses three-part semver: `vX.Y.0` for main releases, `vX.Y.1` / `vX.Y.2` for follow-up sessions on the same version, and `vX.Y.0-design` for design-only sessions (devlog entry only, no git tag). Git tags, devlog headings, and TL;DR anchors must always match. See global CLAUDE.md Project Conventions for the full rule.

## End of Session

Remind SansWord to update `docs/devlog.md` at the end of each session (see global CLAUDE.md for format). When writing a new entry, also update the **TL;DR table** at the top of `docs/devlog.md` with a one-line summary of the new version.

## GitHub Upload Safety

Before committing or pushing any file to GitHub, check for:
- Secrets, API keys, tokens, or passwords (hardcoded or in `.env` files)
- Private personal information beyond what's already public (name, email not intended to be public)
- Bluetooth device pairing keys or hardware identifiers
- Any file not meant to be public (e.g. `.env`, `*.pem`, `*.key`)

CLAUDE.md itself is safe to commit — it contains no secrets.
