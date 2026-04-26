# Historical Cost Deep Dive

A session-archaeology pass through all project JSONLs to find feature sessions predating the three features tracked in `cost-comparison-model-strategy.md`. Goal: see if earlier features add usable data points for model-selection calibration.

---

## Methodology

Scanned all JSONL files in `~/.claude/projects/-Users-sansword-Source-github-sans-cube/` by:
1. Reading `custom-title` events to find renamed sessions
2. Reading first `timestamp` event to sort by date
3. Reading first user message to identify session purpose
4. Reading first assistant event to identify model
5. Cross-referencing with `docs/devlog.md` and `docs/superpowers/specs/` + `plans/` to map sessions to features

---

## Summary of what exists

### Features with clean Superpowers design → plan → implement workflow

Only four features have all phases recoverable with session names:

| Feature | Design | Plan | Implement | Review | In comparison article? |
|---------|--------|------|-----------|--------|------------------------|
| acubemy-import | Opus, named | Opus, named | Opus, named | — | Yes |
| storage-module | Opus, named | Opus, named | Sonnet, named | Sonnet, named | Yes |
| resequence-panel | Opus, named | Sonnet, named | Sonnet, named | Sonnet, named | Yes |
| bulk-recompute | Opus, named | Opus, named | Opus, named | — | Yes |

Everything before acubemy-import (April 18) used ad-hoc single sessions — no distinct plan phase, no named session per phase. The Superpowers multi-session workflow appears to have started with acubemy.

### Features implemented in ad-hoc Sonnet sessions

Several features from April 13–17 were implemented on Sonnet 4.6 but in single unstructured sessions (no separate design/plan/implement split). These don't fit the calibration table but are real Sonnet usage data.

| Feature | Version | Sessions found | Pattern |
|---------|---------|----------------|---------|
| Driver filter | v1.15.0 | 1 unnamed Sonnet session (Apr 14, start: "I want to filter Stats Trend by driver") | ad-hoc design+implement combined |
| Trends chart | v1.5.0 | `implementing trend graph` (Sonnet, 56m) | single implement session |
| URL routing, MAC persistence, code quality | v1.11–1.17 | Multiple small Sonnet sessions, Apr 14 | ad-hoc fixes and features |
| Scramble undo | v1.21.0 | 1 unnamed Sonnet session (Apr 17, 198 turns) | ad-hoc design+implement |
| Commutative ahead | v1.21.1 | 1 unnamed Sonnet session (Apr 17, 240 turns) | ad-hoc design+implement |

---

## M-migration: the significant outlier

M-migration (v1.18–1.19, April 16) is the most interesting pre-acubemy finding. It was implemented entirely on Sonnet 4.6 across multiple sessions, but with **no subagents** and **no recoverable design/plan sessions**.

### Sessions found

| Session name | Model | Tokens | Cost | Engaged | Turns | Subagents |
|---|---|---|---|---|---|---|
| `implmenetation M-migration phase 1` | Sonnet 4.6 | 95.81M | $61.71 | 5h 4m | 925 | 0 |
| `breaking change for M-move logic` | Sonnet 4.6 | 32.05M | $22.52 | 3h 18m | 351 | 0 |
| `implementation m-migration-part-2` (×2) | Sonnet 4.6 | 27.49M | $13.59 | 2h 7m | 298 | 0 |

Combined: ~155M tokens, ~$98 total, ~10h 29m engaged.

### What's missing

- **Design session:** the spec `docs/superpowers/specs/2026-04-15-phase3-m-move-design.md` exists, but no matching session found — likely unnamed or deleted.
- **Plan session:** the plan `docs/superpowers/plans/2026-04-16-phase3-implementation.md` exists; the implement session's first message references it ("Execute the plan in docs/superpowers/plans/2026-04-16-phase3-implementation.md"), so a plan session definitely ran — but no matching session found.

Without design cost, the implement/design ratio can't be calculated, so M-migration can't be added to the main calibration table.

### Why M-migration is a different pattern

| | M-migration | storage-module | resequence-panel |
|---|---|---|---|
| Model | Sonnet | Sonnet implement | Sonnet plan+implement |
| Subagents | **None** | 32 Sonnet subs | 21 Haiku + 2 Sonnet subs |
| Phase 1 tokens | **95.81M** in one session | 22.61M main | 14.81M main |
| Phase 1 turns | **925** | 213 | 185 |
| Phase 1 cost | $61.71 | $10.53 main | $7.08 main |

Phase 1 alone accumulated 95.81M tokens in a single session without subagent isolation. Compare that to storage-module's 22.61M main-loop tokens with 32 subagents handling the rest. The pattern shows clearly: **without subagents, the main loop's cache-read tail balloons** — 95.81M vs 22.61M for sessions of similar complexity.

This is the strongest evidence for subagent delegation being worth it: same model (Sonnet), but no-subagents cost $61.71 for phase 1 vs $10.53 main + $14.96 subs = $25.49 total for the entire storage-module implement phase (which was a more complex feature).

### What could be concluded if design cost were known

If a design session were ever recovered (or estimated from spec file size and complexity), M-migration could add:
- A data point for Sonnet implement **without** subagents
- A comparison against Sonnet implement **with** subagents (storage, resequence)
- Validation (or refutation) that subagents reduce main-loop token bloat

For now, the finding is recorded but not included in the main comparison.

---

## Earlier features: no usable data

Features from April 9–14 (analytics, solve sharing, method update, hash router, driver filter, trends chart) all show the same pattern: small to medium Sonnet sessions, no separate plan phase, no named sessions. These are noise for calibration purposes — they reflect a pre-Superpowers ad-hoc workflow and can't be compared against the structured design→plan→implement data.

---

## Recommendation for future data collection

The gap this archaeology exposed: sessions before acubemy weren't renamed, so the plan session for M-migration is lost. The `new-feature-data-collection.md` prompt addresses this going forward with the rename habit:

> Always `/rename` each session before closing it, using the pattern `[feature] - design`, `[feature] - plan`, `[feature] - implement`, `[feature] - review`.

If you ever run a similar Sonnet-without-subagents session (deliberately or accidentally), **rename it immediately** and note the feature's design cost — that's the missing piece that would make M-migration's data usable.

---

*Related: [Model strategy cost comparison](cost-comparison-model-strategy.md) · [Session quality analysis](session-analysis-model-quality.md)*
