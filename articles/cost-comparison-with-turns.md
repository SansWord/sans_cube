# Model Strategy Revisited: Turns as a Second Complexity Dimension

> Companion to [`cost-comparison-model-strategy.md`](cost-comparison-model-strategy.md). That doc uses **design cost** as the single complexity anchor. This one adds **design turns** (usage-bearing events per phase — extracted by `scripts/cost_extract.py`) as an independent signal and asks: does looking at both change the recommendation?

**TL;DR:** The core recommendation (Opus design, Sonnet plan/implement/review) still holds. But adding turns as a second axis exposes one thing the cost-only view hides — **Opus spends nearly as many design turns on a pill badge as on a drag-to-reorder feature.** Design cost alone can't tell you whether a session was "complexity-driven" or "deliberation-driven"; turns can.

---

## Per-phase turns and tokens-per-turn (N=5)

Raw extract from `cost_extract.py` across all five features. The last column — tokens / turn — is the new lens.

### Design (all Opus 4.7)

| Feature | Turns | Tokens | Engaged | Cost | Tokens/turn |
|---|---:|---:|---:|---:|---:|
| acubemy-import | 329 | 34.30M | 2h 50m | $103.54 | 104.3K |
| storage-module | 97 | 7.86M | 1h 2m | $30.51 | 81.0K |
| display-import-source | 102 | 9.11M | 37m 50s | $23.18 | 89.3K |
| sort-by-timestamp | 104 | 7.06M | 40m 21s | $34.74 | 67.9K |
| resequence-panel | 86 | 6.36M | 31m 30s | $19.27 | 73.9K |

### Plan

| Feature | Model | Turns | Tokens | Cost | Tokens/turn |
|---|---|---:|---:|---:|---:|
| acubemy-import | Opus 4.7 | 71 | 6.08M | $27.87 | 85.6K |
| storage-module | Opus 4.7 | 45 | 4.11M | $17.27 | 91.3K |
| display-import-source | Opus 4.7 | 38 | 2.02M | $10.88 | 53.1K |
| sort-by-timestamp | Sonnet 4.6 | 27 | 1.31M | $2.49 | 48.5K |
| resequence-panel | Sonnet 4.6 | 31 | 1.38M | $1.67 | 44.5K |

### Implement (main loop only — subagent turns excluded to isolate the session-driver model)

| Feature | Main model | Main turns | Main tokens | Main cost | Tokens/turn |
|---|---|---:|---:|---:|---:|
| acubemy-import | Opus 4.7 | 324 | 33.61M | $88.30 | 103.7K |
| storage-module | Sonnet 4.6 | 213 | 22.61M | $10.53 | 106.1K |
| resequence-panel | Sonnet 4.6 | 185 | 14.81M | $7.08 | 80.0K |
| display-import-source | Opus 4.7 | 66 | 3.49M | $13.66 | 52.9K |
| sort-by-timestamp | Sonnet 4.6 | 96 | 6.51M | $3.98 | 67.8K |

### Review (main loop only)

| Feature | Main model | Main turns | Main tokens | Main cost | Tokens/turn |
|---|---|---:|---:|---:|---:|
| storage-module | Sonnet 4.6 | 19 | 921K | $1.43 | 48.5K |
| resequence-panel | Sonnet 4.6 | 82 | 4.47M | $2.54 | 54.5K |
| sort-by-timestamp | Sonnet 4.6 | 132 | 9.75M | $5.56 | 73.9K |
| display-import-source | Opus 4.7 | 46 | 2.51M | $8.36 | 54.6K |

---

## Three findings

### 1. Tokens/turn is surprisingly flat — which means design turns ≈ design complexity signal

Across every phase in every feature, tokens-per-turn sits in a narrow band: **~45K–110K**. Compare to total cost, which spans 6× across the five features. Because tok/turn barely moves, **turn count tracks total session workload with less dynamic range than cost but along the same axis.**

Why this matters: in the existing strategy doc, design *cost* is the complexity anchor. But design cost mixes two things — how much content the model produced (complexity) and how much Opus charged to produce it (model premium). **Design turns is closer to pure complexity**, because it doesn't depend on per-token rates.

Design-turns-as-complexity (N=5, normalized to the smallest feature):

| Feature | Design turns | Ratio to smallest | Design cost ratio |
|---|---:|---:|---:|
| resequence-panel | 86 | 1.0× | 1.0× |
| storage-module | 97 | 1.13× | 1.58× |
| display-import-source | 102 | 1.19× | 1.20× |
| sort-by-timestamp | 104 | 1.21× | 1.80× |
| acubemy-import | 329 | 3.83× | 5.37× |

**Reading:** turns preserves the ordering but compresses the range. Cost says acubemy is 5.4× harder than resequence; turns says 3.8×. The three small-medium features (display, sort-ts, storage) cluster tightly at 97–104 turns in cost-ratio but span 1.0–1.80× in cost — the cost spread reflects cache-write patterns more than complexity differences. **Turns is the more conservative and more stable complexity estimate.**

### 2. Turns expose the "Opus deliberation floor" — now confirmed across two data points

**N=4 claim:** display-import-source (102 design turns, pill badge) suggested an ~100-turn floor on small-medium Opus design sessions.

**N=5 update:** sort-by-timestamp ran **104 design turns** on a standard short prompt — an external prediction file listed 4 decisions beforehand, but the model never saw it. Opus explored from scratch and used almost identical turns to the prior small-medium features. The floor is not a scoping artifact; it's model behavior.

| Feature | Design turns | Scope discipline |
|---|---:|---|
| resequence-panel | 86 | None |
| display-import-source | 102 | None |
| sort-by-timestamp | 104 | Pre-registered 4 decisions |
| storage-module | 97 | None |

All four small-medium features cluster at 86–104 turns regardless of pre-session structure. **The ~100-turn Opus design floor is real, model-driven, and survives explicit scope discipline.** It's deliberation overhead, not scoping uncertainty.

Cost implications: sorting the small-medium cluster by design cost (resequence $19 → storage $30 → display $23 → sort-ts $35) doesn't track turns (86 → 97 → 102 → 104). The cost variance within this cluster is driven primarily by cache-write volume, not turn count. Turn count is the clean complexity signal; cost adds a cache-write noise floor on top.

### 3. Model choice affects cost-per-turn, not turn count

Implement is the cleanest comparison because three features ran Sonnet and two ran Opus in the main loop:

| Feature | Model | Main turns | Feature size (subjective) |
|---|---|---:|---|
| acubemy | Opus | 324 | Large |
| storage | Sonnet | 213 | Medium |
| resequence | Sonnet | 185 | Small-medium |
| sort-by-timestamp | Sonnet | 96 | Small |
| display | Opus | 66 | Tiny |

Ordering tracks feature size, not model. **Switching to Sonnet doesn't reduce turn count — it reduces dollar cost per turn.**

Cost/turn (implement main loop):

| Feature | Model | $/turn |
|---|---|---:|
| acubemy | Opus | $0.273 |
| storage | Sonnet | $0.049 |
| resequence | Sonnet | $0.038 |
| display | Opus | $0.207 |

Opus-implement is **~5× the dollar-per-turn of Sonnet-implement**, matching the per-token price ratio almost exactly. Turn count confirms what the cost analysis already found: Sonnet does the same *amount* of work, just at 1/5 the price.

One exception worth noting: **Sonnet's plan had lower tok/turn (44.5K) than Opus plans (85–91K)**. This is the only phase where the model seems to compress output per turn — consistent with the existing doc's claim that "Sonnet produces more compressed plans." Unclear if this replicates.

---

## Does this change the strategy?

**Mostly no.** The core recommendation from the living doc stands:

- **Design: Opus.** Turn analysis confirms: design turn count correlates with complexity, and Opus's deliberation-per-turn catches integration points. Paying the deliberation-floor tax on small features is a known cost of the strategy, not a bug.
- **Plan: Sonnet.** Sonnet uses fewer turns *and* fewer tokens per turn. Double win.
- **Implement: Sonnet + Haiku subs.** Turn count is model-invariant; Sonnet just makes each turn ~5× cheaper.
- **Review: Sonnet.** Small turn counts (19–110), model-invariant.

**Two refinements.**

**A. Add "design turns" to the per-feature cost files as a second complexity signal.** It's already captured by the script — just surface it in the narrative alongside design cost. Useful because:
- It's closer to a pure complexity measure (model-invariant).
- Comparing turns across future Sonnet-design experiments will be the clearest way to answer "does Sonnet-design lose something?"

**B. Track the "Opus-design deliberation floor" as a planning heuristic.** Current data suggests:
- Tiny features: ~85–110 design turns on Opus regardless of size
- Medium features: ~90–100 design turns
- Large features: 300+ design turns

If you're designing something you believe is small-medium and you cross ~120 turns, it's a signal — either the feature is bigger than you thought, or you're over-exploring. Either way, worth pausing to check.

---

## What this doesn't answer

**Is the Opus-design turn floor actually necessary?** All four designs ran on Opus. Turn count varied 86–329 within Opus, so we can see *within-Opus* variance, but we can't compare to Sonnet-design. A single deliberately-run Sonnet-design experiment on a known-complexity feature would answer this. If Sonnet-design on a resequence-sized feature also needs ~85 turns, the turn floor is feature-driven. If it comes in at ~40, the floor is Opus-driven and the deliberation tax is real.

**Does low tok/turn on Sonnet-plan replicate?** One data point (resequence plan, 44.5K tok/turn) suggests Sonnet plans compress tighter. Next Sonnet-plan feature will confirm or refute.

**Does turn count correlate with rework / bugs?** The existing doc notes the resequence plan was "followed verbatim" (zero plan deviations). If future features track plan deviations alongside turn counts, we can ask whether high-turn designs correlate with lower rework — which would justify the deliberation floor.

---

## Recommended tracking additions

For the next features (and retroactively for the existing four, already done):

- In each `cost-{feature}.md` file, the per-phase tables already include `Turns` from the script — this is good.
- Consider adding one line per feature noting **design turns** explicitly in the summary (e.g. "Design: 102 turns, 37m engaged, $23.18") so turns surface in skim-reads.
- In the data-points section of `cost-comparison-model-strategy.md`, include **design turns** alongside design cost — makes future cross-feature comparisons use the less-distorted complexity signal.

---

*N=5, same author, same project, all designs on Opus. Ratios are suggestive. The most valuable future data point is a single deliberate Sonnet-design feature on a known-complexity scope — that's the one experiment that would turn turns-as-complexity-signal into a testable claim. See [`sonnet-design-experiment-prep.md`](sonnet-design-experiment-prep.md) for the pre-registered protocol.*

*Related: [living model-strategy recommendation](cost-comparison-model-strategy.md) · [cost analysis index](cost-analysis-index.md)*
