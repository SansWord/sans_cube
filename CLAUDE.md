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

**Hooks** (`src/hooks/`) — `useCubeDriver`, `useCubeDriverEvent`, `useCubeState`, `useGyro`, `useGestureDetector`, `useSolveRecorder`, `useSolveStore`, `useCloudSync`, `useTimer`, `useScramble`, `useScrambleTracker`, `useReplayController`, `useMethod`, `useSharedSolve`

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

## Worktree discipline

When working inside a git worktree (e.g. `.worktrees/<feature>/`), the worktree is for **implementation code only**. Shared-main files must not be edited from the worktree — doing so creates merge conflicts that defeat the point of using a worktree in the first place.

**Do not edit from inside a worktree:**
- `future.md` — backlog lives on main; cross off completed items only after merge, in the main checkout.
- `docs/devlog.md` — session entries are written on main at end of session.
- `docs/superpowers/specs/**` — brainstorm/spec docs belong to main and should already exist before the worktree is created.
- `docs/superpowers/plans/**` — the plan file being executed should already be committed on main before the worktree is created; don't amend it mid-execution from the worktree.
- Existing `docs/*.md` files unrelated to the feature.

**OK to edit from inside a worktree:**
- Implementation code (`src/**`, `tests/**`, config).
- New `docs/*.md` files that document the new feature itself.
- Doc files whose update is intrinsic to the feature (e.g. `docs/ui-architecture.md` when the feature changes the component tree) — but scope the edit tightly to what the feature requires.

**Pre-worktree commit rule:** Before creating a worktree to execute a plan, commit the spec + plan + any `future.md` updates to main first. The worktree starts from that commit, so the docs are already in place and there's no reason to re-edit them.

If you find yourself wanting to edit one of the forbidden files from a worktree, stop and either (a) make the edit on the main checkout in a separate commit, or (b) queue it as a note for after the merge.

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

All cost articles are indexed in [`articles/cost-analysis-index.md`](articles/cost-analysis-index.md). The living recommendation + accumulated data points live in [`articles/cost-comparison-model-strategy.md`](articles/cost-comparison-model-strategy.md).

### "Add cost analysis of this feature" shortcut

When SansWord says **"add cost analysis of this feature"** (or equivalent like "add cost analysis for {feature}"), he has just finished 4 sessions named:

```
{FEATURE_NAME} - design
{FEATURE_NAME} - plan
{FEATURE_NAME} - implement
{FEATURE_NAME} - review
```

Run the full cost-analysis flow:

1. **Extract per-phase cost** — run `scripts/cost_extract.py` four times, once per phase, using the session names above:

   ```bash
   python3 scripts/cost_extract.py \
     --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
     --label design "{FEATURE_NAME} - design"
   # ... repeat with --label plan / implement / review
   ```

2. **Resolve session UUIDs** — during the cost extract, note the UUID of each session JSONL file (the filename stem). These go into the per-feature cost file so sessions can be re-opened directly without re-discovery.

   To resolve a session name → UUID (if not already known from the extract run):
   ```bash
   python3 -c "
   import json; from pathlib import Path
   project_dir = Path.home() / '.claude/projects/-Users-sansword-Source-github-sans-cube'
   target = '{FEATURE_NAME} - design'.lower()
   for f in sorted(project_dir.glob('*.jsonl')):
       last = None
       [last := e.get('customTitle','') for line in open(f) if (e := json.loads(line.strip())) and e.get('type') == 'custom-title']
       if last and last.lower() == target: print(f.stem); break
   "
   ```

3. **Extract the design kick-off prompt** — find the first user message in the design session that initiated the design work (may be the very first message, or a later one in a pre-design discussion; look for the turn where designing actually started). Include it verbatim in the per-feature file under a `**Design kick-off prompt:**` field. Also note whether it was a **short prompt** (feature description only, no pre-registered decisions) or a **pre-framed prompt** (decision list or spec passed in). This distinction matters for interpreting design turn counts.

   To read the first user message:
   ```bash
   python3 -c "
   import json; from pathlib import Path
   p = Path.home() / '.claude/projects/-Users-sansword-Source-github-sans-cube/{UUID}.jsonl'
   for line in open(p):
       ev = json.loads(line.strip())
       msg = ev.get('message', {}) or {}
       if isinstance(msg, dict) and msg.get('role') == 'user':
           content = msg.get('content', '')
           blocks = content if isinstance(content, list) else [{'type':'text','text':content}]
           for b in blocks:
               if isinstance(b, dict) and b.get('type') == 'text': print(b['text'][:500]); break
           break
   "
   ```

4. **Create per-feature file** — `articles/cost-{feature-slug}.md`. Use the same format as existing files (e.g. `cost-sort-timestamp.md`): title, `**Shipped:** YYYY-MM-DD (vX.Y.Z)` line, `**Sessions:**` UUID table, `**Design kick-off prompt:**` with prompt text and short/pre-framed label, one section per phase with its token table + cost, main-loop-vs-subagents split where applicable, summary table, and a short Notes section.

5. **Update the index** — add a row at the top of the **Per-feature breakdowns** table in `articles/cost-analysis-index.md` (newest first).

6. **Append a data point** — add a new dated entry under the **Data points** section of `articles/cost-comparison-model-strategy.md`. The entry must state:
   - Strategy used (which model per phase)
   - Per-phase cost table
   - **What changed** — claims the new data point refines or contradicts
   - **What didn't change** — claims the new data point confirms

7. **Re-check the recommendation** — if the new evidence shifts the recommended model strategy, update the **"Current Recommendation"** block at the top of `cost-comparison-model-strategy.md` (bump date and N). If it doesn't shift, say so explicitly in the data-point entry.

8. **Update the experiment overview** — in `articles/experiment-overview.md`:
   - Append a row to the **Strategy matrix** with the feature name, version, per-phase model+cost, total.
   - Fill in **Tier 1 outcome signals** (shipped, 7-day patch, tests pass, review verified). These are automatic — pull from `git log` and the review session JSONL.
   - **Ask SansWord for the 5-tier verdict** (A–F) and the one-line reason. Do this before closing out — the verdict is the only human-only dimension and can't be inferred.
   - Mark the consumed pre-assignment slot as done; promote the next slot.
   - If the kill criterion fired (Sonnet-design required re-design on Opus, or two consecutive D/F verdicts), add a note under Kill criterion and revert the affected slots.

Each feature gets its own cost file in `articles/`. The older cross-feature comparison [`cost-comparison-acubemy-vs-storage-module.md`](articles/cost-comparison-acubemy-vs-storage-module.md) is kept as a two-feature deep dive but is no longer the place to append new data points — use `cost-comparison-model-strategy.md` for that.

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
