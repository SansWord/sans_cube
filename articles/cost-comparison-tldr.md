# Cost Comparison Session — TL;DR

**Session name:** cost comparison  
**Date:** 2026-04-21  
**Model:** Sonnet 4.6 (main + 4 subagents)  
**Engaged:** 24m 2s  
**Cost:** $4.89

---

## What we did

### 1. Built the model strategy comparison article
Read three existing feature cost files (acubemy-import, storage-module, resequence-panel) and the prior two-feature comparison. Identified that the three features represent three different model strategies:

- acubemy: Opus for all phases
- storage-module: Opus design+plan, Sonnet implement+review
- resequence-panel: Opus design only, Sonnet plan+implement+review

Wrote `articles/cost-comparison-model-strategy.md` — a full per-phase cost analysis with normalized ratios, counterfactuals, and a recommended model strategy.

### 2. Analyzed session JSONL files for qualitative quality signals

Dispatched three parallel subagents to read the actual JSONL session files:

- **Plan quality (resequence Sonnet plan):** Plan was followed verbatim — all 8 tasks executed in order, no deviations, zero plan-quality corrections. Sonnet preemptively called out specific traps. High quality at 1.38M tokens vs 4–6M for Opus plans.
- **Review quality (Sonnet for both storage + resequence):** Substantive, not rubber-stamping. Found real issues — dead state from async→sync migration, implicit JS undefined behavior, a spec typo — using actual verification commands.
- **Opus vs Sonnet implementation behavior:** Same final output quality, different deliberativeness. Opus independently verifies suspicious reviewer findings; Sonnet acts on them immediately. Opus lays out options on ambiguous decisions; Sonnet compresses to action.

### 3. Wrote the session quality article
`articles/session-analysis-model-quality.md` — full methodology, per-session findings, and a synthesized model strategy table with confidence levels.

### 4. Updated the comparison article
Added "Beyond cost: time, quality, and process" section to `cost-comparison-model-strategy.md` covering engaged time (3× drop from all-Opus to Opus-design-only), plan quality evidence, review quality evidence, and the Opus vs Sonnet process comparison table.

### 5. Created the data collection prompt
`articles/new-feature-data-collection.md` — a reusable prompt to paste at the start of a fresh session after any shipped feature. Runs cost_extract.py for all four phases, does JSONL quality analysis, and produces a consistent cost file + calibration row.

---

## Key findings from this session

| Question | Answer |
|----------|--------|
| Is Sonnet plan good enough? | Yes — followed verbatim, accurate preemptive callouts, no quality gap found |
| Is Sonnet review substantive? | Yes — finds real issues with real reasoning; quality correlates with plan's self-review checklist |
| Does Opus implement produce better output? | No — same final artifacts; difference is process deliberativeness, not output quality |
| What does all-Opus actually cost beyond dollars? | ~3× more engaged time; more verbose sessions; no artifact quality gain on well-specified features |
| Recommended strategy | Opus for design, Sonnet for plan + implement + review |
| All-Opus worth it when | Novel architecture, loose spec, high rework cost, or ambiguous integration |

---

## Session cost breakdown

| | Model | Turns | Total tokens | Cost |
|-|-------|-------|-------------|------|
| Main loop | Sonnet 4.6 | 57 | 3.46M | $3.38 |
| Subagents (Sonnet ×3) | Sonnet 4.6 | 39 | 1.17M | $1.40 |
| Subagents (Haiku ×1) | Haiku 4.5 | 6 | 106.1K | $0.12 |
| **Total** | | **102** | **4.73M** | **$4.89** |

The three Sonnet subagents were the parallel JSONL analysis agents (plan quality, review quality, Opus vs Sonnet impl comparison). The Haiku subagent was the codebase exploration for session file listing.

**Cost as % of features analyzed:**
- vs resequence-panel ($34.90): 14%
- vs storage-module ($76.89): 6%
- vs acubemy-import ($246.90): 2%

This session cost less than a single resequence review phase ($3.53).

---

## Files produced

- `articles/cost-comparison-model-strategy.md` — model strategy per phase, cost ratios, quality findings, calibration table
- `articles/session-analysis-model-quality.md` — detailed JSONL analysis with methodology and per-session findings
- `articles/new-feature-data-collection.md` — reusable data collection prompt for future features
- `articles/cost-comparison-tldr.md` — this file
