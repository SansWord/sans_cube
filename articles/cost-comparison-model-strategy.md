# Model Strategy Per Phase: Which Model Belongs Where?

> **This is the living document** that accumulates per-feature cost data points and keeps the model-selection recommendation current. When a new feature ships, append a data point to the **"Data points"** section at the bottom and, if the new evidence shifts the recommendation, update the block below.

## Current Recommendation (as of 2026-04-23, N=5)

| Phase | Model | Rationale |
|-------|-------|-----------|
| **Design** | **Opus** | Architecture decisions, integration-point identification, catching flaws early. Sets the complexity ceiling for everything downstream. |
| **Plan** | **Sonnet** | Mechanical translation of design into task structure. ~7–10% of design cost on Sonnet vs 27–57% on Opus. No observed quality loss. |
| **Implement** | **Sonnet (main) + Haiku subs** | Cache-read-dominated; model judgment matters least here. Haiku for mechanical tasks, Sonnet for code generation. |
| **Review** | **Sonnet** | Sufficient for structural review and ~3× cheaper per token than Opus. Note: review cost scales with implementation surface area, not just feature category. |

**Planning heuristic:** total feature cost ≈ **1.5–1.8× design cost** under the recommended strategy. Range reflects implementation size: focused single-feature work lands near 1.5×; medium-complexity features near 1.8×. Design cost is still the best single predictor of total cost.

**Features tracked:** acubemy-import · storage-module · resequence-panel · display-import-source · sort-by-timestamp — see [Data points](#data-points) at the bottom of this article and the [cost analysis index](cost-analysis-index.md).

---

## Original analysis (N=3)

Three features, three different model strategies. All three used Opus 4.7 for design — so design cost is a clean complexity yardstick. The differences are in plan, implement, and review.

## The three strategies

| Feature | Design | Plan | Implement | Review |
|---------|--------|------|-----------|--------|
| acubemy-import | Opus 4.7 | Opus 4.7 | Opus 4.7 + subs | — |
| storage-module | Opus 4.7 | Opus 4.7 | Sonnet 4.6 + subs | Sonnet 4.6 |
| resequence-panel | Opus 4.7 | Sonnet 4.6 | Sonnet 4.6 + subs | Sonnet 4.6 |

> "subs" = subagents dispatched inline — Haiku 4.5 for mechanical tasks, Sonnet or Opus for judgment-heavy ones.

## Phase costs

| Phase | acubemy (Opus) | storage (Opus D+P, Sonnet I+R) | resequence (Opus D, Sonnet P+I+R) |
|-------|---------------|-------------------------------|----------------------------------|
| Design | $103.54 | $30.51 | $19.27 |
| Plan | $27.87 | $17.27 | $1.67 |
| Implement | $115.49 | $25.49 | $10.43 |
| Review | — | $3.62 | $3.53 |
| **Total** | **~$247** | **$76.89** | **$34.90** |
| Total tokens | ~93.6M | 59.18M | 41.58M |
| Total engaged | ~5h 16m | ~2h 28m | ~101m |

---

## Phase-by-phase analysis

### Design — Opus everywhere, no comparison data

All three features ran design on Opus 4.7. Design cost correlates with feature complexity and is the single best predictor of total cost (see [acubemy vs storage comparison](cost-comparison-acubemy-vs-storage-module.md)). No model-choice insight here — but the design cost is the anchor for everything below.

Design costs: $103.54 (acubemy) · $30.51 (storage) · $19.27 (resequence) — reflecting genuine complexity differences.

### Plan — Sonnet wins decisively

| Feature | Plan model | Plan cost | Plan/Design ratio |
|---------|-----------|-----------|-------------------|
| acubemy | Opus 4.7 | $27.87 | 26.9% |
| storage | Opus 4.7 | $17.27 | 56.6% |
| resequence | Sonnet 4.6 | $1.67 | 8.7% |

Resequence ran plan on Sonnet and spent **8.7% of design cost**. The two Opus-plan features spent 27–57% of design cost. Even accounting for Sonnet's ~5× lower per-token price, resequence's plan session also consumed fewer total tokens (1.38M vs 4.11M for storage, 6.08M for acubemy) — Sonnet produces more compressed plans.

**Why plan is safe on Sonnet:** planning is mechanical. The hard thinking happened in design. The plan session converts the design doc into a structured task list — the model is reading a document and emitting checkboxes, not reasoning about architecture tradeoffs. Sonnet handles that translation well and at a fraction of the cost.

**Counterfactual:** if storage's plan had run on Sonnet at the same token profile (~$3.50 estimated vs actual $17.27), the plan phase would have been ~5× cheaper. Combined with the lower token count resequence achieved, moving to Sonnet for plan is probably a **5–10× savings** on this phase.

### Implement — Sonnet + Haiku subs is the right pattern

| Feature | Impl model | Impl cost | Impl/Design ratio | Impl tokens |
|---------|-----------|-----------|-------------------|-------------|
| acubemy | Opus 4.7 | $115.49 | 111.5% | ~74.2M |
| storage | Sonnet 4.6 | $25.49 | 83.5% | 42.08M |
| resequence | Sonnet 4.6 | $10.43 | 54.1% | 28.44M |

Three observations:

**1. Implement costs more than design when running on Opus.** acubemy's implement phase ($115.49) exceeded its already-expensive design phase ($103.54). Implementation accumulates a long cache-read tail as context grows — at Opus rates, that's punishing.

**2. Sonnet's implement/design ratio is lower than Opus's.** acubemy: 112%. storage: 84%. resequence: 54%. Some of that gap is genuine feature-size differences (resequence is a lighter implementation than storage). But switching from Opus to Sonnet is clearly the main driver — the same cache-read-dominated token profile costs ~5× less.

**3. Haiku subagents help the Sonnet case further.** resequence used 21 Haiku subs for mechanical tasks (code scanning, spec reviews), keeping total implement cost at $10.43 for a 28.44M-token session. storage used Sonnet-only subs and still came in at $25.49. The Haiku+Sonnet subagent pattern is the cheapest viable implementation stack.

### Review — Sonnet, cheap, and size-invariant

| Feature | Review model | Review cost | Review tokens | Review/Design ratio |
|---------|-------------|-------------|---------------|---------------------|
| storage | Sonnet 4.6 | $3.62 | 5.13M | 11.9% |
| resequence | Sonnet 4.6 | $3.53 | 5.40M | 18.3% |

The two Sonnet review sessions cost nearly the same dollar amount ($3.53–$3.62) despite being different-sized features. Review appears largely size-invariant: the reviewer reads the plan and the diff, not the full session history. Both review sessions finished within 6–28 minutes engaged.

No comparison data for Opus review. But given the cost is already small (~10–20% of design) and Sonnet appears sufficient for structural code review, there's no incentive to escalate to Opus here.

---

## Recommended model strategy

| Phase | Model | Rationale |
|-------|-------|-----------|
| **Design** | **Opus** | Architecture decisions, integration point identification, catching design flaws early — Opus's judgment matters most here. This phase sets the complexity ceiling for everything downstream. |
| **Plan** | **Sonnet** | Mechanical translation of design into task structure. Sonnet handles it at 8–10% of design cost vs 27–57% on Opus. No observed quality loss. |
| **Implement** | **Sonnet (main) + Haiku subs** | Cache-read dominated, model judgment matters least. Haiku for mechanical tasks (spec review, simpler agents), Sonnet for code generation. |
| **Review** | **Sonnet** | Cheap and size-invariant. Structural code check against the plan — Sonnet is sufficient. |

## Cost structure under recommended strategy

Taking resequence as the reference (it's the closest to the recommended strategy), the cost breakdown looks like:

| Phase | Share of total |
|-------|---------------|
| Design (Opus) | 55% |
| Plan (Sonnet) | 5% |
| Implement (Sonnet+Haiku) | 30% |
| Review (Sonnet) | 10% |

**Design dominates.** This is correct — design is where the real intellectual work happens. If you're optimizing cost, the lever is feature scope, not model choice on execution phases.

## The counterfactual: all-Opus vs recommended strategy

Applying the recommended strategy retroactively to acubemy-import (which ran all-Opus):

| Phase | Actual (Opus) | Hypothetical (recommended) |
|-------|--------------|---------------------------|
| Design | $103.54 | $103.54 (unchanged) |
| Plan | $27.87 | ~$5–6 (Sonnet, ~1/5 rate on ~6M tokens) |
| Implement | $115.49 | ~$23–25 (Sonnet, ~1/5 rate) |
| Review | — | ~$4–6 (Sonnet, estimated) |
| **Total** | **$246.90** | **~$135–140** |

Estimated savings: **~$110 (~45%)** — mostly from the implement phase. The design rigor is fully preserved; you're only switching the execution phases to cheaper models.

This is consistent with the earlier [acubemy vs storage analysis](cost-comparison-acubemy-vs-storage-module.md), which estimated a ~35% savings from Sonnet implementation — the additional saving here comes from also switching plan to Sonnet.

---

## Beyond cost: time, quality, and process

Dollar cost is only part of the picture. Reading the actual JSONL session files adds two more dimensions: engaged time and process robustness.

### Engaged time

| | acubemy (Opus all) | storage (Opus D+P, Sonnet I+R) | resequence (Opus D, Sonnet P+I+R) |
|-|---|---|---|
| Total engaged | ~5h 16m | ~2h 28m | ~101m |

Engaged time — your actual attention at the keyboard — drops roughly 3× between all-Opus and Opus-design-only. Sonnet generates fewer tokens per turn and streams noticeably faster. Even on a small feature, this shows up as a snappier session feel.

### Plan quality: Sonnet holds up

The resequence-panel plan (Sonnet) was followed **verbatim** — all 8 tasks executed in exact order, no items skipped or modified, zero mid-course corrections due to plan ambiguity. The plan preemptively called out specific integration traps (a `React.CSSProperties` namespace import issue, a counter update ordering constraint) and included a scope coverage self-check table mapping every spec requirement to a task.

The only rework in the implement session was two subagent worktree incidents (writing to `main` instead of the feature branch) — both self-caught by the main loop. Neither was caused by a plan ambiguity.

**Plan cost vs quality:** Sonnet generated a compressed plan (1.38M tokens vs 4–6M tokens for Opus plans on comparable features) that was equally actionable. No quality regression observed.

### Review quality: Sonnet is substantive

Both Sonnet reviews (storage-module and resequence-panel) ran real verification commands — `npm run test`, `npm run build`, targeted `git show` and `grep` — and found specific, reasoned issues:

- **Storage review:** identified a dead state left over from an async→sync migration (required understanding the code's history), caught a naming inconsistency, and found a spec typo by cross-referencing spec against plan against implementation.
- **Resequence review:** caught that `s.seq !== i + 1` evaluates to `true` when `seq` is `undefined` (JavaScript type coercion), meaning old imported solves without a `seq` field get renumbered correctly — right behavior, but implicit and untested.

Neither review required post-review code changes — both features shipped clean. But the findings required real reasoning, not surface scanning.

**Caveat:** both features had explicit self-review checklists built into their plans. That structure scaffolded the reviewer's work. A vague plan with no checklist may expose a lower ceiling for Sonnet review.

### Process quality: what model choice actually affects

Reading the JSONL files for Opus (acubemy implement) vs Sonnet (storage implement), the behavioral difference is not in final artifact quality — it's in **deliberativeness**:

| Dimension | Opus | Sonnet |
|-----------|------|--------|
| Ambiguous decisions | Lays out labeled options before acting | Reaches conclusion quickly, acts |
| Reviewer verification | Independently verifies suspicious findings before dispatching fixes | Accepts reviewer output, acts immediately |
| Coordination errors | One wrong-branch commit — self-detected, self-corrected | None observed |
| Integration checks | Proactively greps for APIs before wiring tasks | Same pattern |
| Final output quality | Correct, shippable | Correct, shippable |

On well-specified features with accurate reviewers, this difference doesn't show up in the output. The risk is on ambiguous features or when reviewer feedback is wrong: Sonnet is more likely to act on a false positive without checking.

Both models proactively verified integration seams before dispatching wiring tasks. Neither dove into code without reading the plan first.

### When all-Opus makes sense

All-Opus is worth considering when:
- The feature involves novel architecture with no prior art in the codebase
- The spec is intentionally loose (exploring design space during implementation)
- You expect integration surprises that require judgment calls mid-session
- The cost of a wrong turn (rework, rollback) is high relative to the phase cost

For well-specified features on a familiar codebase — which the Superpowers design → plan → implement workflow produces — the Sonnet strategy is sufficient.

---

## Summary

- **Design:** Opus. Non-negotiable — this phase determines architectural quality.
- **Plan:** Sonnet. 8–10% of design cost vs 27–57% on Opus. No observed quality tradeoff.
- **Implement:** Sonnet + Haiku subs. 5× cheaper per token; Haiku subs add another layer of savings on mechanical work.
- **Review:** Sonnet. Small, size-invariant, and Sonnet is sufficient for structural review.
- **All-Opus downside:** ~3× more engaged time, ~45% more cost, and more verbose sessions — with no improvement in final artifact quality on well-specified features.

**Planning heuristic from prior analysis:** implement cost ≈ 1.1× design cost (regardless of model). With the recommended strategy, multiply your expected design cost by ~1.8 to estimate total feature cost (design + 0.1× plan + 1.1× implement + 0.2× review).

*N=3 features, same project, one author. Ratios are suggestive, not statistical.*

---

<a name="data-points"></a>
## Data points

New features ship into this section as dated entries. Each entry records: strategy, per-phase costs, what the new evidence changed (if anything), and what it confirmed.

### display-import-source — 2026-04-22 (v1.28.0)

A fourth feature — **display-import-source** (v1.28.0) — shipped after this article was written. It ran **all four phases on Opus 4.7** (like acubemy) but the feature scope was tiny: a pill badge in `SolveDetailModal`. This data point doesn't change the recommendations above, but it refines two of the quantitative claims.

### The fourth strategy

| Feature | Design | Plan | Implement | Review |
|---------|--------|------|-----------|--------|
| display-import-source | Opus 4.7 | Opus 4.7 | Opus 4.7 | Opus 4.7 + sub |

### Phase costs

| Phase | display-import-source | Engaged |
|-------|----------------------|---------|
| Design | $23.18 | 37m 50s |
| Plan | $10.88 | 3m 44s |
| Implement | $13.66 | 3m 57s |
| Review | $12.01 | 13m 2s |
| **Total** | **$59.73** | **~58m** |

### What changed

**1. "Implement costs more than design when running on Opus" was overreach.**

The original claim came from acubemy alone (implement/design = 112%). display-import-source is also all-Opus but implement/design = **59%** — well below design. So Opus implement doesn't automatically exceed design; it depends on feature scope. The correct reading: acubemy's 112% was the worst-case combination of all-Opus + large implementation surface, not a rule.

Updated data for the implement/design ratio across all four features:

| Feature | Implement model | Impl/Design |
|---------|----------------|-------------|
| acubemy | Opus 4.7 | 1.12 |
| storage | Sonnet 4.6 | 0.84 |
| resequence | Sonnet 4.6 | 0.54 |
| display-import-source | Opus 4.7 | 0.59 |

**2. The "implement ≈ 1.1× design cost regardless of model" planning heuristic is too strong.**

With N=4, the ratios span 0.54–1.12. Better framing: **design cost is an upper-bound anchor for implement**; 1.1× was the worst case (acubemy). For planning, assume implement ≈ 0.6–1.1× design depending on scope and model.

**3. First Opus-review data point reinforces the Sonnet-review recommendation.**

The two prior reviews were both Sonnet ($3.53 and $3.62 on 5.13–5.40M tokens). display-import-source reviewed on Opus: **$12.01 on 3.07M tokens** — roughly **3× the dollar-per-token** of Sonnet review, on a smaller session. No quality benefit observed vs the Sonnet reviews. "Sonnet for review" is not just cheaper, it's ~3× cheaper per unit of work.

**4. All-Opus has a cost floor even for tiny features.**

display-import-source is a pill badge — arguably the smallest shippable UI change. All-Opus still came to **$59.73** with a 4-minute implement phase costing $13.66. Useful anchor: on Opus, even trivial work costs tens of dollars per phase; the per-token rate dominates session size.

### What didn't change

- **Plan/design ratio on Opus** is still 27–57% (display-import-source: 46.9%). Consistent with the "Sonnet plan is 5–10× cheaper" recommendation.
- **Recommended model strategy** (Opus-design + Sonnet-everywhere-else) is unchanged. This data point strengthens rather than challenges it — a tiny feature running all-Opus still costs ~$60, most of which would vanish under the recommended strategy.
- **Total-cost-is-design-anchored** intuition holds: design was still the single largest phase ($23.18 of $59.73, 39%).

*N=4 features now. Recommendations unchanged; two quantitative claims above relaxed.*

---

### sort-by-timestamp — 2026-04-23 (v1.29.0)

A fifth feature — **sort-by-timestamp** (v1.29.0) — ran the **recommended strategy** (Opus design, Sonnet plan/implement/review) and came with a pre-registered prediction file, making it the first feature with enumerated design decisions written down before the session. Total: **$51.70** across 548 turns and ~96m engaged.

### Strategy

| Feature | Design | Plan | Implement | Review |
|---------|--------|------|-----------|--------|
| sort-by-timestamp | Opus 4.7 | Sonnet 4.6 | Sonnet 4.6 + subs | Sonnet 4.6 + sub |

### Phase costs

| Phase | Cost | Turns | Engaged |
|-------|------|------:|---------|
| Design | $34.74 | 104 | 40m 21s |
| Plan | $2.49 | 27 | 8m 12s |
| Implement | $7.99 | 270 | 16m 52s |
| Review | $6.48 | 147 | 31m 20s |
| **Total** | **$51.70** | **548** | **~96m** |

### What changed

**1. The 1.8× planning heuristic is too tight — range is now 1.49–1.81× across three recommended-strategy features.**

sort-by-timestamp came in at **1.49× design cost** ($51.70 / $34.74), below the resequence-anchored 1.8× heuristic. Implement was only 23% of design cost — the lowest implement/design ratio in the dataset — because the feature's execution was focused (three Trends files, 16m implement). The heuristic assumed medium-complexity features; small focused features land closer to 1.5×.

Updated implement/design ratios across all five features:

| Feature | Implement model | Impl/Design |
|---------|----------------|-------------|
| acubemy | Opus 4.7 | 1.12 |
| storage | Sonnet 4.6 | 0.84 |
| resequence | Sonnet 4.6 | 0.54 |
| display-import-source | Opus 4.7 | 0.59 |
| sort-by-timestamp | Sonnet 4.6 | 0.23 |

Range is now 0.23–1.12. Heuristic updated to **1.5–1.8× design** (see Current Recommendation block at the top).

**2. "Review is size-invariant" is too strong.**

Prior two Sonnet reviews cost $3.53 and $3.62. sort-by-timestamp review cost **$6.48** — nearly double — because the implementation touched multiple Trends files and the reviewer spent 31m and 9.75M tokens checking the full surface. Review cost appears to track implementation surface area, not just feature category. "Cheap and bounded" is still true relative to Opus, but "size-invariant" overstates it.

Updated Sonnet review costs:

| Feature | Review cost | Review tokens | Engaged |
|---------|-------------|---------------|---------|
| storage-module | $3.62 | 5.13M | 5m 35s |
| resequence-panel | $3.53 | 5.40M | 27m 53s |
| sort-by-timestamp | $6.48 | 10.48M | 31m 20s |

**3. Opus-design turn floor confirmed with a standard short prompt.**

sort-by-timestamp's design session ran on a standard short prompt ("let's design this feature") — no decision list or pre-framing was given to the model. An external prediction file had 4 decisions written down beforehand, but the model never saw it. Opus explored from scratch and used **104 design turns** — nearly identical to display-import-source (102 turns) on comparable scope. The ~100-turn floor on small-medium features appears model-driven, not a scoping artifact.

### What didn't change

- **Plan/Design ratio on Sonnet** lands at 7.2% (sort-by-timestamp) vs 8.7% (resequence). Both in the 7–10% band — the Sonnet plan cost estimate is the most reliable phase in the workflow.
- **Recommended strategy is unchanged.** This is the second full recommended-strategy feature (after resequence), and it shipped cleanly at $51.70 total. Compare to display-import-source at $59.73 all-Opus — the recommended strategy was cheaper even on a larger-surface feature.
- **Design cost dominates total cost.** Design was $34.74 of $51.70 (67%) — higher design-share than any prior feature. On small features under the recommended strategy, design is where the money goes.

*N=5 features. Heuristic relaxed to a range (1.5–1.8×). Review size-invariance claim weakened. Design turn floor strengthened.*

---

*Related: [acubemy vs storage-module comparison](cost-comparison-acubemy-vs-storage-module.md) · [session quality analysis](session-analysis-model-quality.md) · [turns as second complexity dimension](cost-comparison-with-turns.md) · [acubemy-import cost breakdown](cost-acubemy-import.md) · [storage-module cost breakdown](cost-storage-module.md) · [resequence-panel cost breakdown](cost-operation-resequence-panel.md) · [display-import-source cost breakdown](cost-display-import-source.md) · [sort-by-timestamp cost breakdown](cost-sort-timestamp.md)*
