# Acubemy-import feature — three-phase cost breakdown (Opus 4.7)

← [Back to article: *Cost analysis for a feature on Opus 4.7* → Headline numbers](./opus-4-7-cost-analysis.md#headline-numbers)

> **The feature:** acubemy-import adds a JSON-import pipeline, a preview modal, schema-versioned local storage, and solvability verification so users of a personal speedcubing app can bulk-import their solve history from a third-party tracker. Built across three Superpowers sessions (design → plan → implementation), all on Claude Opus 4.7.
>
> **This doc:** measures the API dollar cost and plan-limit cost of those three sessions, checks whether the implementation-phase subagent delegation actually saved money, and puts the numbers next to the much smaller "freeform" feature tracked in [`comparison.md`](comparison.md).

## TL;DR

- [**API dollar cost**](#api-totals-per-phase) (all three phases): ~**$246.90** — design $103.54 · planning $27.87 · implementation $115.49.
- [**Plan-limit cost**](#plan-limit--estimate-rough): ~**45–47%** of a Max 5x session (Opus 4.7 in all three phases).
- [**Subagent effect**](#did-subagents-make-implementation-cheaper): Haiku subagents saved ~**$35** of counterfactual Opus cost; Opus subagents saved $0 per-token but kept the main-loop cache clean.
- [**Vs freeform-4.7**](#vague-comparison-with-freeform-47-comparisonmd) in [`comparison.md`](comparison.md): ~**3.4× the dollars** for ~**3.2× the lines** — roughly linear scaling on the same model, but engaged time scaled super-linearly (~**2.95×** per unit of complexity).
- [**Hybrid-mode counterfactual**](#does-this-validate-the-hybrid-mode-suggestion): Opus design+plan + Sonnet execute would likely have cost ~**$155–165** instead of $247 — saving ~**$80–90** (~35%).
- **Cost of writing this analysis:** ~**$56** (Opus 4.7, ~18.1M tokens, ~85 min engaged, no subagents) — about **23%** of the feature it's analyzing. (Excludes separate planning work for a follow-up article, which ran in the same session but cost ~$16 more on top.)

## Model

All three sessions ran on **`claude-opus-4-7`** in the main loop. No model switch mid-feature.

Subagent models (implementation phase only):
- **Haiku 4.5** (`claude-haiku-4-5-20251001`) — 19 subagents, mostly spec-reviews and mechanical implementation of simpler tasks.
- **Opus 4.7** — 12 subagents, used for judgment-heavy implementation (e.g. parseExport orchestrator, commit flow, wiring modal) and `superpowers:code-reviewer` review passes.

## Session windows

Wall-clock uses first user prompt → last assistant message. "Engaged" excludes truly-idle pauses (you typed `Bye!` and closed the session), but includes live collaboration, doc-review pauses, and Claude's own tool/subagent work.

| Session | Session ID | Wall-clock | Engaged time | Notes |
|---|---|---:|---:|---|
| **design** | `16b15663…b615` | 14h 22m | **~3h 06m** | Two long away gaps (7h 58m + 3h 18m) after `Goodbye!` / `Bye!` — excluded from engaged time. Also auto-compacted once at ~11:06 UTC. |
| **planning** | `7dd0b412…dfc9` | 57m 20s | **~57m** (all engaged) | The 39-min pause at the end was you reviewing the written plan before the phase-handoff. If you exclude plan-review time: ~18m of live chat. |
| **implementation** | `6994d6a2…f723b` | 1h 13m 18s | **~1h 13m** (all engaged) | Continuous; only a 9-min gap waiting for a subagent dispatch. |

<details>
<summary><strong>Pause context for the design session (why the 14h figure is misleading)</strong></summary>

| Pause | Context before | Category |
|---:|---|---|
| 12 min | You asked a technical v1→v2 question; Claude was drafting the answer | Claude working |
| **7h 58m** | You typed `Goodbye!` and closed the session | **Truly idle** (excluded) |
| **3h 18m** | You typed `Bye!` and closed the session again | **Truly idle** (excluded) |
| 18 min | Claude had just committed a schema note to `future.md`; your next message was a correction referencing it | Reviewing committed doc |
| 5 min | Claude: "I'll leave the change uncommitted for your review"; you came back with a field question | Reviewing committed doc |

</details>

## Token breakdown (scoped to first-prompt → last-message)

| | Design (Opus) | Planning (Opus) | Impl. main (Opus) | Impl. Opus subs (×12) | Impl. Haiku subs (×19) |
|---|---:|---:|---:|---:|---:|
| Assistant turns | 329 | 71 | 324 | 219 | 431 |
| Input | 1,137 | 113 | 487 | 349 | 8,342 |
| Output | 407,287 | 127,393 | 191,123 | 53,973 | 48,545 |
| Cache read | 33,113,910 | 5,628,050 | 32,586,085 | 6,275,205 | 11,756,623 |
| Cache write (5m) | 0 | 0 | 0 | 597,323 | 883,635 |
| Cache write (1h) | 776,793 | 328,992 | 835,816 | 0 | 0 |
| **Total billable tokens** | **34.30M** | **6.08M** | **33.61M** | **6.93M** | **12.70M** |

Combined: **~93.6M tokens** across the three phases (+ subagents).

## Published per-token rates (Anthropic API, April 2026)

Rates used (per million tokens) — same rate card as [`cost.md`](cost.md):

| Model | Input | Output | Cache read | Cache write (5m) | Cache write (1h) |
|---|---|---|---|---|---|
| Opus 4.x | $15.00 | $75.00 | $1.50 | $18.75 | $30.00 |
| Haiku 4.5 | $1.00 | $5.00 | $0.10 | $1.25 | $2.00 |

## Applied to scoped token counts

| | Design | Planning | Impl. main | Impl. Opus subs | Impl. Haiku subs |
|---|---:|---:|---:|---:|---:|
| Input | $0.02 | $0.00 | $0.01 | $0.01 | $0.01 |
| Output | $30.55 | $9.55 | $14.33 | $4.05 | $0.24 |
| Cache read | $49.67 | $8.44 | $48.88 | $9.41 | $1.18 |
| Cache write | $23.30 | $9.87 | $25.07 | $11.20 | $1.10 |
| **Subtotal** | **$103.54** | **$27.87** | **$88.30** | **$24.67** | **$2.53** |

## API totals per phase

| Phase | API cost | Share |
|---|---:|---:|
| Design | **$103.54** | 41.9% |
| Planning | **$27.87** | 11.3% |
| Implementation (main + Opus subs + Haiku subs) | **$115.49** | 46.8% |
| **Grand total** | **~$246.90** | 100% |

## Did subagents make implementation cheaper?

Two different effects — worth separating:

### Haiku subagents: direct savings ~$35
19 subagents dispatched to Haiku 4.5 processed **12.70M tokens** for **$2.53**.

If those same tokens had been billed at Opus rates (as they would have been, had they stayed inline in the Opus main loop), the cost would have been **~$37.97** — a saving of **~$35** from routing them to Haiku.

This is only a rough counterfactual — inline execution wouldn't have duplicated the per-subagent cache-write overhead, so the real "save" is probably a bit lower. But the directional effect is clear: mechanical tasks (spec reviews, simpler implementations) delegated to Haiku were ~15× cheaper than doing them inline on Opus.

### Opus subagents: no direct savings, but probably reduced main-loop cache pressure
12 subagents ran on Opus 4.7 for **6.93M tokens / $24.67**. Per token, this is the same rate as inline Opus work. So no direct savings.

The indirect effect (not directly measurable from JSONLs): each Opus subagent starts with an isolated context window. If those tasks had stayed in the main loop, the main-loop cache_read would have grown further for every subsequent turn — potentially much more than the 32.59M cache_read actually observed. So dispatching Opus subagents likely kept the main-loop cache-read bill from ballooning, even though it didn't cut the per-task price.

### Net effect on implementation phase

- Actual implementation total: **$115.49** ($88.30 main + $24.67 Opus subs + $2.53 Haiku subs).
- Worst-case estimate if all subagent work had been inline-Opus (same tokens, same rate, ignoring cache dynamics): **~$151** (+ $35 from Haiku counterfactual, nothing from Opus counterfactual).
- Estimated savings from subagent delegation: **~$35** (≈ 23% of the worst-case implementation cost).

The Superpowers plugin chose subagents aggressively enough that delegation paid off measurably — consistent with the [`comparison.md`](comparison.md) observation that Sonnet 4.6 offered the subagent-driven choice and saw an 8× end-to-end cost advantage.

## Plan-limit % estimate (rough)

I didn't record the live plan-limit indicator during these three sessions. To get a ballpark, I use the one data point we do have from [`comparison.md`](comparison.md):

- Freeform-4.7 Opus run: 27.35M Opus tokens → 15% of a Max 5x session.
- Implied Opus rate: **~0.548% per MTok**.

For Haiku, the comparison doesn't give a clean per-token plan rate; I bracket it at Opus/7.5 (matching the Haiku-to-Opus API price ratio) on the low end and Opus/3 on the high end.

| Component | Tokens | Plan-limit % |
|---|---:|---:|
| Design (Opus) | 34.30M | 18.8% |
| Planning (Opus) | 6.08M | 3.3% |
| Impl. main (Opus) | 33.61M | 18.4% |
| Impl. Opus subs | 6.93M | 3.8% |
| Impl. Haiku subs | 12.70M | 0.9% – 2.3% |
| **Estimated total** | | **~45.3% – 46.7%** |

**Caveats:** this is a linear extrapolation from a single data point. Plan-limit weighting isn't published and may not scale linearly across token types or session sizes. Treat this as a ballpark, not a measurement.

## Feature size — diff-stat breakdown

Line counts are a flawed proxy for effort — they count characters, not insight — but they help sanity-check whether the 3.4× cost ratio vs freeform-4.7 reflects a proportional jump in output volume or something else. Spec and plan docs are included below because they're real artifacts the model produced, even though they aren't committed code.

| Artifact | Freeform-4.7 (Opus) | Acubemy-import (Opus, three phases) | Ratio |
|---|---:|---:|---:|
| Spec (`docs/superpowers/specs/…design.md`) | 107 | 427 | 4.0× |
| Plan (`docs/superpowers/plans/….md`) | 819 | 1,791 | 2.2× |
| Production code (`src/`) | 40 | 576 | 14.4× |
| Tests (code, excludes fixtures) | 71 | 429 | 6.0× |
| Shipped docs (devlog, feature docs, edits to existing docs) | 22 | 136 | 6.2× |
| Misc (`.gitignore`, future.md etc.) | 1 | 4 | — |
| **Sum (excluding test fixtures)** | **1,060** | **3,363** | **~3.2×** |
| Test fixtures (JSON) | 0 | 15,567 | — raw acubemy export, not hand-written |

**Reading.** The line-count ratio (~3.2× excluding fixtures) tracks the token-cost ratio (~3.4×) surprisingly closely. That isn't because LOC = effort — it's because both are rough proxies for "total content the model produced." The scaling breaks down if you look at production code alone (14.4×): that one number massively overestimates complexity because a lot of acubemy-import's "work" is concentrated in the spec and plan (data-format analysis, slice-pairing research, v1→v2 schema decisions) rather than in typing TypeScript.

**Caveat on LOC as a metric.** Counting lines rewards verbose formatting and long design docs more than concise ones. The acubemy plan is 1,791 lines vs freeform-4.7's 819 — partly because acubemy has more tasks and more code, but partly because the plan was structured with more checkbox scenarios and explicit Task-N headers. Don't over-index on single-metric ratios.

## Vague comparison with freeform-4.7 ([`comparison.md`](comparison.md))

Both runs used the same model (Opus 4.7) and the same Superpowers brainstorm → plan → execute workflow. Direct side-by-side:

| | Freeform-4.7 (one session) | Acubemy-import (three sessions) | Ratio |
|---|---:|---:|---:|
| Model | Opus 4.7 | Opus 4.7 | same |
| Superpowers phases | brainstorm + plan + execute (inline) | design + planning + implementation (3 separate sessions) | — |
| Subagents used | 0 | 31 (19 Haiku + 12 Opus) | — |
| Total tokens | 27.35M | ~93.62M | 3.4× |
| API dollar cost | $73.06 | ~$246.90 | 3.4× |
| Plan-limit % | 15% (observed) | ~45–47% (estimated) | ~3× |
| Total lines produced (spec + plan + code + tests + docs) | 1,060 | 3,363 | 3.2× |
| Wall-clock (first prompt → last msg) | 33m 33s | ~16h 33m (mostly design idle) | — |
| **Engaged time** — your attention spent, a cost to minimize | 33m 33s | ~5h 16m (3h 06m design + 57m plan + 1h 13m impl) | **~9×** |

**Reading:** acubemy-import is a genuinely heavier feature. Cost scaling is roughly proportional to token count (3.4× tokens = 3.4× API dollars), which is expected when running the same model. Plan-limit scaling is similar.

The implementation phase alone ($115.49 / ~21% plan-limit) is larger than the entire freeform feature ($73.06 / 15%) — reasonable given acubemy-import adds a full import pipeline, UI modal, preview table, and docs, whereas freeform was a ~50-LoC method addition.

**Important framing note on engaged time.** Engaged time is a cost you pay — your attention spent shipping the feature — not an output or efficiency metric. A feature that takes 9× more of your time is 9× more expensive *in attention*, regardless of dollar cost. Do not read "low dollar-per-minute" as a cheapness metric; it just means you sat at the keyboard longer for the same shipped thing.

## Relative effort — how much "bigger" was acubemy?

If freeform-4.7 is a 5-point story, what is acubemy? Honest answer: depends on what "points" measure.

| Anchor | Ratio | Acubemy (if freeform = 5) |
|---|---:|---:|
| Lines produced (spec + plan + code + tests + docs) | 3.2× | ~16 pts |
| API tokens / dollars | 3.4× | ~17 pts |
| Engaged time | 7.9× | ~40 pts |
| Dimension-weighted complexity read (subjective) | 2.6× | ~13 pts |

The most defensible single number is **~16 points** — matches observed cost, matches content volume, and doesn't require Fibonacci anchoring. (An earlier read of 13 points was me preferring a "neat" Fibonacci number over fitting the data; the honest linear answer is higher.)

### The more interesting question: per point, which costs are linear?

| Cost per point | Freeform (5 pts) | Acubemy (16 pts) | Ratio |
|---|---:|---:|---:|
| $ API | $14.6 | $15.4 | **1.06× — flat** |
| Engaged time (your attention) | 6.7 min | 19.8 min | **2.95× — super-linear** |

**Reading:**

- **Dollar cost scales linearly with output.** Same model, same rate card: 3× more content = 3× more cost. Harder features aren't intrinsically more token-expensive per unit of output — the model charges you for the content it produces, not for how hard the problem was.
- **Your time scales super-linearly with complexity.** Harder features require more design iteration, review cycles, and uncertainty resolution that the token counter doesn't see. You pay proportionally in dollars but **disproportionately in your attention**.

### Implications

1. **Money isn't the real scaling pain on complex features.** On same-model work, cost-per-point is nearly flat. If a feature gets expensive in dollars, it's because the output grew — not because the problem was hard.
2. **Subagents help the dollar side, not the time side.** 31 subagents on acubemy-impl parallelized Claude's work, but review and approval were still sequential on you. Subagent workflows are a compute-parallelism win, not an attention-parallelism win.
3. **Spec+plan discipline pays off mostly in attention, not tokens.** Front-loading uncertainty resolution into focused design/planning sessions saves your time on complex features — even if it barely moves the token count. That's the actual reason the three-phase split was worth it here.

### Caveats on the point estimate

- I co-wrote both features, so my complexity read is post-hoc rationalization, not a forward-looking sprint estimate.
- Reference class is N=2 — two features on one project, one author. Calibrate on your own data before using these numbers for planning.
- "Points" is scale-relative: if your team's 5-point story is larger than freeform-as-measured-here, scale both up proportionally — the ratio is the stable part.
- The quaternion-reference-frame verification deferred to `future.md` could add ~2–3 points of rework if it turns up a frame mismatch. Not included in the 16-point estimate.

## Does this validate the hybrid-mode suggestion?

Comparison.md's closing suggestion:

> Use Opus for brainstorm + plan (where the hash-router integration point would have been caught during planning, before any code was written), then `/clear` and run Sonnet for execute-plan (where most of the Opus cost lived: 83% of Opus's tokens were cache reads during execution).

Applied to acubemy-import *in retrospect* (the feature is already shipped — this is only a what-if):

- **Opus design + planning (kept):** $103.54 + $27.87 = **$131.41**.
- **Sonnet implementation (hypothetical replacement for $115.49 Opus implementation):** Sonnet API rates are 1/5 of Opus across the board, so the same implementation-phase token profile on Sonnet would cost roughly **$115.49 / 5 ≈ $23**. Add ~$2.50 for Haiku subagents (unchanged) → ~$25–30.
- **Hybrid estimated total:** **~$155–165** (vs actual $246.90) — a **~35% savings**.

This is broadly consistent with the [`comparison.md`](comparison.md) estimate of "~$15–20 for a freeform-sized hybrid run" scaling up ~8× for this feature. The savings come almost entirely from the implementation phase, where cache-read dominates and model judgment matters least.

**What the hybrid would likely have missed:** [`comparison.md`](comparison.md) flagged that Sonnet-on-freeform skipped the hash-router integration point in its plan. Whether a Sonnet implementer would have caught all the integration points Opus caught for acubemy-import (gyro timing quirks, cloud-sync routing, schema-version v1→v2 handling) is unknowable without running it — but the comparison suggests Opus's value is mostly in the planning phase, which is preserved in the hybrid.

**Bottom line on the hybrid hypothesis:** the observed cost profile here — 53% of spend in implementation, 83% cache-read — fits the shape [`comparison.md`](comparison.md) flagged. A hybrid would plausibly have shipped this same feature for ~$90 less (~35% cheaper) without sacrificing the design/planning rigor that catches integration points. Validated by extrapolation, not by replication.

## Methodology

- Token counts, model IDs, and tool-call breakdowns extracted from the session JSONLs at `~/.claude/projects/-Users-sansword-Source-github-sans-cube/` and the per-session `subagents/` subfolders.
- Costs computed from Anthropic's published per-MTok rates (April 2026) applied to raw usage fields (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation.ephemeral_5m_input_tokens`, `cache_creation.ephemeral_1h_input_tokens`).
- Plan-limit % is a linear extrapolation from a single observed data point (15% for 27.35M Opus tokens in the freeform-4.7 run). Not a measurement.
- "Active time" is sum of inter-event deltas where gap ≤ 10 minutes — intended to capture normal tool-use + short review pauses while excluding multi-hour idle.
- Each phase ran in its own brand-new Claude Code session (via `/exit` + relaunch — hence three separate JSONL files). The only carryover between phases was the written doc from the previous phase: the design doc into the plan session, and the plan doc into the implement session. This is why the token breakdown decomposes cleanly per phase — each session started with an empty conversation, so cache-read totals reflect only that phase's work.
- No re-run of this feature on Sonnet — the hybrid-mode figures are extrapolated from the freeform-4.6 cost profile, not measured.

*AI-assisted analysis — verify critical details independently.*

---

← [Back to article: *Cost analysis for a feature on Opus 4.7* → Headline numbers](./opus-4-7-cost-analysis.md#headline-numbers)
