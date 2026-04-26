# Prediction — Sort-by-Timestamp Toggle in Trends

> **Pre-commit file.** Written before the design session to serve as the control. After the feature ships, compare actuals against these predictions and log the delta in the feature's cost file and in [`cost-comparison-model-strategy.md`](cost-comparison-model-strategy.md).

**Feature:** Sort-by-timestamp toggle in Trends — offer a sort mode that orders by cubeTimestamp instead of solve seq, to normalize the backward time-jump in the chart after an import.

**Why this matters for tracking:** this is the first feature with a pre-registered design-decision list. If design cost / turns drop vs the sibling anchor, it's evidence that scope discipline compresses Opus design sessions. If they match the anchor, Opus's deliberation floor is model-driven, not scoping-driven.

---

## Strategy

| Phase | Model | Note |
|---|---|---|
| Design | Opus 4.7 | Fifth Opus-design data point; first with a pre-registered decision list |
| Plan | Sonnet 4.6 | Current recommended strategy |
| Implement | Sonnet 4.6 main + Haiku 4.5 subs | Current recommended strategy |
| Review | Sonnet 4.6 | Current recommended strategy |

## Pre-registered design decisions

These are the decisions the design session should address. After the session, check the spec for coverage.

1. **Toggle placement** — where does the sort-mode control live in the Trends UI? (top bar near existing filters? settings menu? chart-adjacent?)
2. **Default mode** — does Trends default to seq (current behavior) or cubeTimestamp (arguably more correct after imports)?
3. **Persistence** — does the user's choice persist in localStorage, or reset per session?
4. **Scope of the toggle** — does the toggle only affect Trends, or also sidebar / other seq-ordered views?

## Expected integration surface

- `src/components/TrendsModal.tsx` — primary
- Possibly a new localStorage key (`docs/storage.md` touch)
- Possibly `docs/trends-zoom.md` or `docs/ui-architecture.md` doc touch

## Sibling anchor

**[display-import-source](cost-display-import-source.md)** — 102 design turns, $23.18, 37m 50s engaged, 89.3K tokens/turn.

Same complexity class: small UI addition with a taxonomy-ish decision. Good anchor because both features are single-file UI changes with 3–4 bounded design questions.

## Predictions

### Per-phase

| Phase | Predicted turns | Predicted cost | Anchor |
|---|---:|---:|---|
| Design (Opus) | 70–110 | $18–28 | display-import-source (102 turns, $23) |
| Plan (Sonnet) | 25–40 | $1.50–3.00 | resequence-panel (31 turns, $1.67) |
| Implement (Sonnet) | 60–150 | $2–5 | display-import-source (66 Opus turns → ~$2–4 at Sonnet rate); single-file change with few subs |
| Review (Sonnet) | 60–100 | $3–4 | storage/resequence reviews (~$3.50) |

### Total

- **Predicted total cost: $25–40**
- **Predicted design/total ratio: ~0.7–0.8** (design is the largest phase by far on small features under this strategy)
- **Predicted total turns: ~200–350** (across all phases, main + subs)

### Planning heuristic check

The current living doc estimates **total ≈ 1.8× design cost** under the recommended strategy. For this feature: predicted design ~$23 × 1.8 = **$41**. My per-phase prediction comes in slightly below that at $25–40, because a single-file change should compress implement and plan harder than the heuristic's N=4 average. If actuals match the heuristic better than my per-phase prediction, that's evidence the heuristic is more robust than size-specific reasoning.

## Turn-floor hypothesis test

This Opus-design run is the first test of whether **pre-registered scope reduces Opus design turns**. Three outcomes:

| Outcome | Implication |
|---|---|
| Design lands at 90–110 turns | Opus floor is model-driven; scoping discipline doesn't compress it much. Strengthens the "deliberation floor is real" claim. |
| Design lands at 50–70 turns | Pre-registered decisions meaningfully compress Opus design. Worth formalizing as process — enumerated decisions in every design session from now on. |
| Design lands at 150+ turns | The 4-decision list was incomplete; the feature had more branching than predicted. Informative failure — update what "known scope" means. |

## What to measure post-session

Fill into the feature's eventual `cost-sort-timestamp.md`:

- Actual turns & cost per phase (from `scripts/cost_extract.py`)
- Actual vs predicted delta table (phase by phase)
- **Decision coverage** — for each of the 4 pre-registered decisions: covered fully / covered partially / not addressed
- **Unexpected decisions** — anything the spec raised that wasn't predicted (often the most useful information)
- **Turn-floor verdict** — which of the three outcomes landed
- **Heuristic check** — did total cost track 1.8× design, or the per-phase prediction?

---

*Related: [turns analysis doc](cost-comparison-with-turns.md) · [experiment prep](sonnet-design-experiment-prep.md) · [sibling anchor cost file](cost-display-import-source.md)*
