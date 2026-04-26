# Model-Per-Phase Experiment — Overview

> **Purpose:** a single scannable doc that tracks the model-per-phase experiment across all features. Serves two roles — demonstration (what we've tested, what's answered) and protocol (what's pre-assigned for upcoming features, when to stop).
>
> **Update when:** a feature ships (append a row), or before starting the next feature (check pre-assignment).

---

## The question

For the 4-phase Superpowers workflow (design → plan → implement → review), **which model should we use at each phase?**

Options at each phase: Opus 4.7 / Sonnet 4.6 / (Haiku 4.5 for mechanical sub-tasks, usually not main-loop).

---

## Success definition

A feature is "successful under a strategy" if all Tier 1 signals hold and the human verdict is ≥ C. No attempt is made to measure "quality" beyond that — the experiment only answers *"does this strategy produce features that ship and stay shipped?"* It does not attempt to answer *"is one strategy categorically better?"*

### Tier 1 — Automatic outcome signals

| Signal | Meaning | How to check |
|---|---|---|
| Shipped | Feature merged to main, tagged | `git log` |
| No 7-day patch | No fix commits against the feature within 7 days of ship | `git log vX.Y.Z..vX.Y+.0 -- src/ \| grep -iE 'fix\|revert'` |
| Tests pass at ship | `npm run test` green at merge commit | Review session JSONL / CI log |
| Review ran verification | Review session executed `npm run test`, `npm run build`, or targeted grep | Read review JSONL for `Bash` tool calls |

### Tier 2 — Human verdict (5-tier)

After the review session, pick one (takes 10 seconds, fill in the cost file's Notes section):

| Grade | Meaning |
|---|---|
| **A** | Would repeat on a harder feature; strategy over-performed |
| **B** | Would repeat on a similar feature; no concerns |
| **C** | Shipped, neutral — no clear win or loss, would consider alternatives |
| **D** | Worked but had concerns; wouldn't repeat without adjustment |
| **F** | Failed or required escalation; would not repeat |

Optionally: one-line reason.

---

## Strategy matrix (N=5)

Model used per phase, with cost. Bold = the model we were deliberately testing for that feature.

| Feature | Version | Design | Plan | Implement | Review | Total |
|---|---|---|---|---|---|---|
| acubemy-import | v1.23.0 | Opus $103.54 | Opus $27.87 | Opus $115.49 | — (no review) | ~$247 |
| storage-module | v1.26.0 | Opus $30.51 | Opus $17.27 | Sonnet $25.49 | Sonnet $3.62 | $76.89 |
| resequence-panel | v1.27.0 | Opus $19.27 | Sonnet $1.67 | Sonnet $10.43 | Sonnet $3.53 | $34.90 |
| display-import-source | v1.28.0 | Opus $23.18 | Opus $10.88 | Opus $13.66 | Opus $12.01 | $59.73 |
| sort-by-timestamp | v1.29.0 | Opus $34.74 | Sonnet $2.49 | Sonnet $7.99 | Sonnet $6.48 | $51.70 |

### Cell coverage

| Phase | Opus | Sonnet | Haiku |
|---|---|---|---|
| Design | 5 | **0** | 0 |
| Plan | 3 | 2 | 0 |
| Implement | 2 | 3 | 0 (main) |
| Review | 1 | 3 | 0 |

**The empty cell is the experiment.** Every design ran Opus — the primary question ("is Opus necessary for design?") cannot be answered with current data.

---

## Outcome & verdict table (backfill what you can; leave verdict for you)

| Feature | Shipped | 7-day patch | Tests | Review verified | Verdict (A–F) | One-line reason |
|---|---|---|---|---|---|---|
| acubemy-import | ✅ | See Note* | ✅ | — (no review) | _ | _ |
| storage-module | ✅ | ✅ (one cosmetic indentation fix, no logic) | ✅ | ✅ | _ | _ |
| resequence-panel | ✅ | ✅ (none) | ✅ | ✅ | _ | _ |
| display-import-source | ✅ | ✅ (none) | ✅ | ✅ | _ | _ |
| sort-by-timestamp | ✅ | ✅ (none) | ✅ | ✅ | _ | _ |

*Acubemy shipped at v1.23.0 and the window to v1.26.0 spans 3 intermediate versions (v1.24.x, v1.25.x) with multiple "fix:" commits. Some touch solveStore (unrelated to acubemy's import pipeline); others are in the acubemy surface. Needs manual attribution to classify cleanly.

**Verdicts: please fill in** — they're the only dimension automation can't capture. One letter per row.

---

## Status per open question

| Question | Status | Evidence | Confidence |
|---|---|---|---|
| Is Opus necessary for design? | **Unanswered** | N=0 Sonnet-design points | N/A |
| Is Sonnet sufficient for plan? | Provisional yes | N=2 Sonnet plans shipped; 7–10% of design cost | Moderate |
| Is Sonnet sufficient for implement? | Provisional yes | N=3 Sonnet implements shipped; ~5× cheaper per turn | Moderate-high |
| Is Sonnet sufficient for review? | Provisional yes | N=3 Sonnet reviews shipped; Opus-review ~3× pricier per token for no measured benefit | Moderate |
| Is the "Opus design floor ~100 turns" real? | Confirmed for small-medium features | N=3 small-medium features at 86/97/102/104 turns | High |

The strategy recommendation (Opus-D, Sonnet P+I+R) rests on the middle three rows. It's defensible but not *proven* — all three rely on "shipped cleanly" as the quality bar, not on measured quality.

---

## Pre-assignment — next 4 features

Strategy is chosen **before** the feature starts, not by feel. Interleave experimental strategies with the current recommendation so workflow drift (skill change, codebase change) can be detected.

| Slot | Feature | Planned strategy | Reason | Kill switch |
|---|---|---|---|---|
| Slot 0 (next) | **Ao5 / Ao12 for phases** (`future.md` Statistic section) | **Sonnet D, Sonnet P+I+R** | First Sonnet-design data point. Pre-scoped in [`sonnet-design-experiment-prep.md`](sonnet-design-experiment-prep.md) with 4 enumerated decisions. Sibling anchor: resequence-panel (86 Opus design turns / $19). | See below |
| Slot 1 | TBD | Opus D, Sonnet P+I+R (current recommendation) | Control: another data point for the recommended strategy, to detect drift. | N/A |
| Slot 2 | TBD (candidate: Save a shared solve into own history) | **Sonnet D, Sonnet P+I+R** | Replication of Slot 0, *only if Slot 0 graded ≥ C*. | See below |
| Slot 3 | TBD | Decide based on Slots 0 & 2 | If both Sonnet-design slots graded ≥ B: push to all-Sonnet. If D or F: return to current recommendation and stop the Sonnet-design branch. | — |

### Kill criterion (when to stop the Sonnet-design branch)

Two rules, either triggers the kill:

1. **Single-strike:** if a Sonnet-design feature requires **re-designing on Opus** during the same feature, that's a hard failure. One is enough to abandon Sonnet-design for this project.
2. **Two-strike:** if a Sonnet-design feature ships but grades **D or F** on the verdict, it's a soft warning. Two consecutive D/F grades → abandon.

If the kill fires, append a note to this doc explaining why, and revert Slot 2+ to the current recommendation.

---

## How to update this doc

On every new feature that goes through design → plan → implement → review:

1. After running `scripts/cost_extract.py` for all four phases and creating `cost-{feature}.md` (see CLAUDE.md shortcut), **append a row to the Strategy matrix**.
2. **Fill in Tier 1 signals** (all automatic — 4 fields).
3. **Fill in the verdict** (Tier 2, one letter, one-line reason). Do this immediately after the review session while context is fresh.
4. **Re-check pre-assignment** — mark the consumed slot as done; promote the next slot to "next."
5. **If the kill criterion fired**, add a note at the bottom of the Kill criterion section with the feature name and reason.

Also: if the **Status per open question** section changes (e.g., first Sonnet-design point shipped), update the Status and Confidence columns.

---

## What this experiment is not

- Not proving "Opus is better" or "Sonnet is better" in absolute terms. Proving betterness requires counterfactuals we don't have.
- Not measuring code quality, spec depth, or design cleverness. Only measuring: did it ship, did it stay shipped, and would I run this strategy again.
- Not statistically meaningful. N=5–10, single author, single project. The output is a working hypothesis for this project, not a universal recommendation.

*Related: [living strategy recommendation](cost-comparison-model-strategy.md) · [turns analysis](cost-comparison-with-turns.md) · [Sonnet-design experiment prep](sonnet-design-experiment-prep.md) · [cost analysis index](cost-analysis-index.md)*
