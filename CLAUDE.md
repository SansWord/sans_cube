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

**Drivers** (`src/drivers/`) — `CubeDriver` (abstract), `GanCubeDriver` (BLE), `MouseDriver`, `ButtonDriver`, `ColorMoveTranslator`

**Services** (`src/services/`) — `firebase.ts` (app init), `firestoreSolves.ts` (Firestore CRUD)

**Hooks** (`src/hooks/`) — `useCubeDriver`, `useCubeDriverEvent`, `useCubeState`, `useGyro`, `useGestureDetector`, `useSolveRecorder`, `useSolveHistory`, `useCloudSync`, `useTimer`, `useScramble`, `useScrambleTracker`, `useReplayController`, `useMethod`, `useSharedSolve`

**Components** (`src/components/`) — `TimerScreen`, `SolveDetailModal`, `SolveHistorySidebar`, `CubeCanvas`, `PhaseBar`, `ScrambleDisplay`, `ConnectionBar`, `OrientationConfig`, `TimerDisplay`, `ControlBar`, `MoveHistory`, `FaceletDebug`, `MethodSelector`

## Documentation (`docs/`)

When creating any new `docs/*.md` file, always add it to this list with a one-line description.

- [`devlog.md`](docs/devlog.md) — session-by-session record of what was built and learned; update at end of each session
- [`debug-mode.md`](docs/debug-mode.md) — what's in debug mode: diagnostic views, Firebase panel, maintenance buttons; update when buttons change
- [`firebase-cloud-sync.md`](docs/firebase-cloud-sync.md) — cloud sync architecture, security, migration behavior, ID design
- [`animation-system.md`](docs/animation-system.md) — Three.js animation details
- [`import-data.md`](docs/import-data.md) — user guide + internal reference for bulk-importing solves from external sources (acubemy in v1)
- [`manual-test-checklist.md`](docs/manual-test-checklist.md) — manual QA checklist
- [`storage.md`](docs/storage.md) — all localStorage keys and Firestore structure; what syncs vs. what's local-only
- [`time-model.md`](docs/time-model.md) — definitions of timeMs, executionMs, recognitionMs, and cubeTimestamp; how they relate
- [`ui-architecture.md`](docs/ui-architecture.md) — component tree, hook ownership per component, data flow, leaf component prop tables
- [`trends-zoom.md`](docs/trends-zoom.md) — drag-to-zoom behavior in TrendsModal: zoom stack, data filtering, x-axis domain, day reference lines
- [`analytics.md`](docs/analytics.md) — Firebase Analytics setup, event reference, consent banner, local dev notes
- [`url-routes.md`](docs/url-routes.md) — all supported hash-based routes (`#debug`, `#solve-{id}`, `#shared-{id}`, `#trends?...`); update when routes change
- [`cube-notation.md`](docs/cube-notation.md) — cube move notation, facelets string format, face index reference, M/E/S cycle indices, GAN BLE protocol semantics
- [`data-backup.md`](docs/data-backup.md) — how to back up and restore localStorage and Firestore solve data before risky operations
- [`cost-analysis.md`](docs/cost-analysis.md) — session cost script usage + rate card reference; **temporary** — remove once extended to a Claude skill

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

## "Ship it" shortcut

When SansWord says **"ship it"** (or equivalent like "let's ship", "ship this"), it means run the full release flow on the current feature branch:

1. **Stage uncommitted work** — commit any pending changes with a clear message.
2. **Update docs** — refresh any affected files in `docs/` (especially `debug-mode.md`, `ui-architecture.md`, etc. per the keep-up-to-date rules above).
3. **Update devlog** — add or refresh the `vX.Y.Z` entry in `docs/devlog.md` and the TL;DR table row at the top. Cross off completed items in `future.md`. Commit these doc changes.
4. **Verify tests** — `npm run test` must pass on the branch before merging.
5. **Merge to main** — `git checkout main && git merge --no-ff <branch> -m "Merge branch '<branch>' — vX.Y.Z <title>"`. Re-run `npm run test` on the merged result.
6. **Tag** — `git tag -a vX.Y.Z -m "vX.Y.Z — <title>"` at the merge commit. If the tag already exists locally on a mid-branch commit (created early in the session), delete and re-create it pointing at the merge commit (only if not yet pushed).
7. **Push** — `git push origin main --follow-tags`.
8. **Clean up** — `git branch -d <feature-branch>`.

If any step fails (test failures, push rejected, etc.), stop and report — don't paper over the failure.

## Session Cost

**Script:** `scripts/cost_extract.py` — works for any single session, with or without a feature workflow.

```bash
python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  "my session name"
```

The first argument is the session name (your `/rename` label) or a path to the `.jsonl`. Name lookup reads the full file to handle sessions renamed mid-way. Subagents are discovered automatically from `<session-uuid>/subagents/*.jsonl` — no manual input needed. Use `--no-subagents` to exclude them.

When SansWord asks **"what did this session cost?"** or **"how much did [session name] cost?"**, run the script with that session name and show the output.

## Feature Cost Tracking

After shipping any feature that went through the design → plan → implement (+ review) workflow, run the script once per phase and append a row to `articles/cost-tracking.md`.

```bash
python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  --label design "storage module design"

python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  --label plan "storage module plan"

# ... repeat for implement and review
```

Output: per-session token table (stable) + cost estimate (rate card–dependent) + a one-line summary row. Save results to `articles/cost-<feature-name>.md` (e.g. `articles/cost-storage-module.md`).

Each feature gets its own cost file in `articles/`. The cross-feature comparison lives in `articles/cost-comparison-acubemy-vs-storage-module.md` — update it when a new data point adds something interesting to the design/implement ratio analysis.

## End of Session

Remind SansWord to update `docs/devlog.md` at the end of each session (see global CLAUDE.md for format). When writing a new entry, also update the **TL;DR table** at the top of `docs/devlog.md` with a one-line summary of the new version.

After writing the devlog entry, also read `future.md` and cross out any items that were completed in this session (strikethrough + version tag), matching the style of existing done items.

## GitHub Upload Safety

Before committing or pushing any file to GitHub, check for:
- Secrets, API keys, tokens, or passwords (hardcoded or in `.env` files)
- Private personal information beyond what's already public (name, email not intended to be public)
- Bluetooth device pairing keys or hardware identifiers
- Any file not meant to be public (e.g. `.env`, `*.pem`, `*.key`)

CLAUDE.md itself is safe to commit — it contains no secrets.
