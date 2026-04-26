# Cost: Sort-by-Timestamp Toggle in Trends

**Shipped:** 2026-04-23 (v1.29.0)

Feature: Trends sort mode toggle — sort chart data by solve seq (default) or cubeTimestamp, normalizing the backward time-jump after an acubemy import. URL param `sort=seq|date`, persisted to localStorage.

Workflow: design → plan → implement → review

**Strategy: Opus D, Sonnet P+I+R** (current recommended strategy)

**Prediction file:** [`cost-sort-timestamp-prediction.md`](cost-sort-timestamp-prediction.md) — design decisions and expected turn/cost ranges written before the session as an external prediction. The design session itself ran on a standard short prompt; the decision list was not passed to the model.

**Design kick-off prompt** *(short prompt — feature description only, no pre-registered decisions):*
> "I have an item in future.md: Sort-by-timestamp toggle in Trends — normalize the backward time-jump in the chart after an import by offering a sort mode that orders by cubeTimestamp instead of solve seq. let's design this feature, ask me any question if needed"

**Sessions:**

| Phase | UUID |
|-------|------|
| design | `1c7f5161-9ae9-4845-88e8-b4dda815aeb9` |
| plan | `1a89d210-b48b-4e94-accd-b5288b1dd405` |
| implement | `dc74f568-010c-4c25-b333-0d4007d50b96` |
| review | `688cabc6-cca0-4646-89da-f0845db1c1e2` |

---

## design

**Model:** claude-opus-4-7  |  **Engaged:** 40m 21s  |  **Subagents:** 0

| Token type  | Count |
|-------------|-------|
| Input             | 321 |
| Output            | 56.9K |
| Cache read        | 6.31M |
| Cache write 5m    | 0 |
| Cache write 1h    | 700.2K |
| **Total**        | **7.06M** |
| Turns           | 104 |

**Cost estimate:** $34.74  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*

---

## plan

**Model:** claude-sonnet-4-6  |  **Engaged:** 8m 12s  |  **Subagents:** 0

| Token type  | Count |
|-------------|-------|
| Input             | 34 |
| Output            | 70.8K |
| Cache read        | 1.05M |
| Cache write 5m    | 0 |
| Cache write 1h    | 186.0K |
| **Total**        | **1.31M** |
| Turns           | 27 |

**Cost estimate:** $2.49  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*

---

## implement

**Model:** claude-sonnet-4-6  |  **Engaged:** 16m 52s  |  **Subagents:** 15

| Token type  | Count |
|-------------|-------|
| Input             | 389 |
| Output            | 81.5K |
| Cache read        | 10.52M |
| Cache write 5m    | 770.4K |
| Cache write 1h    | 222.9K |
| **Total**        | **11.60M** |
| Turns           | 270 |

**Main loop vs subagents:**

| | Model | Files | Turns | Total Tokens | Output | CW 5m | CW 1h | Cost |
|---|-------|-------|-------|-------------|--------|-------|-------|------|
| main | claude-sonnet-4-6 | 1 | 96 | 6.51M | 51.8K | 0 | 222.9K | $3.98 |
| subs | claude-sonnet-4-6 | 14 | 138 | 3.75M | 24.8K | 638.7K | 0 | $3.69 |
| subs | claude-haiku-4-5-20251001 | 1 | 36 | 1.34M | 4.9K | 131.8K | 0 | $0.31 |

**Cost estimate:** $7.99  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*

---

## review

**Model:** claude-sonnet-4-6  |  **Engaged:** 31m 20s  |  **Subagents:** 1

| Token type  | Count |
|-------------|-------|
| Input             | 5.0K |
| Output            | 76.7K |
| Cache read        | 9.94M |
| Cache write 5m    | 198.6K |
| Cache write 1h    | 265.1K |
| **Total**        | **10.48M** |
| Turns           | 147 |

**Main loop vs subagents:**

| | Model | Files | Turns | Total Tokens | Output | CW 5m | CW 1h | Cost |
|---|-------|-------|-------|-------------|--------|-------|-------|------|
| main | claude-sonnet-4-6 | 1 | 132 | 9.75M | 76.1K | 0 | 265.1K | $5.56 |
| subs | claude-sonnet-4-6 | 1 | 15 | 730.0K | 623 | 198.6K | 0 | $0.93 |

**Cost estimate:** $6.48  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*

---

## Summary

| label | model | total tok | input | output | cache read | cw 1h | turns | engaged | cost $ |
|-------|-------|-----------|-------|--------|------------|-------|-------|---------|--------|
| design | claude-opus-4-7 | 7.06M | 321 | 56.9K | 6.31M | 700.2K | 104 | 40m 21s | $34.74 |
| plan | claude-sonnet-4-6 | 1.31M | 34 | 70.8K | 1.05M | 186.0K | 27 | 8m 12s | $2.49 |
| implement | claude-sonnet-4-6 | 11.60M | 389 | 81.5K | 10.52M | 222.9K | 270 | 16m 52s | $7.99 |
| review | claude-sonnet-4-6 | 10.48M | 5.0K | 76.7K | 9.94M | 265.1K | 147 | 31m 20s | $6.48 |
| **total** | | **30.45M** | | | | | **548** | **~96m** | **$51.70** |

---

## Prediction vs actual

From [`cost-sort-timestamp-prediction.md`](cost-sort-timestamp-prediction.md):

| Phase | Predicted turns | Actual turns | Predicted cost | Actual cost | Result |
|---|---:|---:|---:|---:|---|
| Design | 70–110 | **104** | $18–28 | **$34.74** | Turns ✅ within range · Cost ❌ 24% above upper bound |
| Plan | 25–40 | **27** | $1.50–3.00 | **$2.49** | ✅ both within range |
| Implement | 60–150 | **270** | $2–5 | **$7.99** | Turns ❌ 80% above upper bound · Cost ❌ 60% above |
| Review | 60–100 | **147** | $3–4 | **$6.48** | Turns ❌ 47% above upper bound · Cost ❌ 62% above |
| **Total** | 200–350 | **548** | $25–40 | **$51.70** | Both missed; actual 29% above upper bound |

**Summary:** plan was the only phase within both ranges. Implement was more sub-heavy than expected (15 subs vs "few"), and review ran long (31m vs typical 5–27m). The single-file-change assumption was wrong — the feature touched multiple Trends files, driving both implement and review higher.

### Heuristic check

Current heuristic: **total ≈ 1.8× design cost** → expected $34.74 × 1.8 = **$62.53**

Actual: **$51.70 = 1.49× design**

Actual fell *below* the heuristic. The heuristic over-predicted because implement at 23% of design is the lowest implement/design ratio in the dataset — this feature's execution phases were very cheap relative to its design phase.

---

## Ratios and comparisons

| | sort-by-timestamp | resequence (Opus D, Sonnet P+I+R) | display (all-Opus) |
|---|---|---|---|
| Design cost | $34.74 | $19.27 | $23.18 |
| Design turns | 104 | 86 | 102 |
| Plan/Design ratio | 7.2% | 8.7% | 46.9% (Opus) |
| Implement/Design ratio | 23.0% | 54.1% | 59.0% |
| Review/Design ratio | 18.7% | 18.3% | 51.8% (Opus) |
| Total/Design ratio | **1.49×** | **1.81×** | **2.58×** |

**Plan/Design 7.2%** — consistent with resequence (8.7%), confirming Sonnet plan reliably lands at ~7–10% of Opus design cost regardless of feature size.

**Implement/Design 23.0%** — notably lower than the N=4 range of 54–111%. Single digit implement hours on a focused feature. See Notes.

**Review/Design 18.7%** — similar to resequence (18.3%) but absolute cost $6.48 vs $3.53 because the feature had more implementation surface to review (see Notes).

---

## Turn-floor verdict

Predicted outcome: design lands at **90–110 turns** → "Opus floor is model-driven; scoping discipline doesn't compress it much."

**Confirmed.** 104 design turns on a standard short-prompt session — the prediction file listed 4 decisions externally but was never passed to the model. Opus explored the design space from scratch and still landed at ~100 turns. This is the second small-medium feature in a row (display-import-source: 102, sort-by-timestamp: 104) landing in the same narrow band. The ~100-turn floor on Opus design for this complexity class is robust even without any pre-framing.

### Decision coverage

*(To be filled in from memory of the design session — check spec against the 4 pre-registered decisions:)*

1. **Toggle placement** — covered? [ ]
2. **Default mode (seq vs cubeTimestamp)** — covered? [ ]
3. **Persistence (localStorage)** — covered? [ ]
4. **Scope of toggle (Trends only vs sidebar too)** — covered? [ ]
5. **Unexpected decisions raised:** *(e.g. URL param design, xIndex rename, windowing refactor)*

---

## Notes

- **Design cost above prediction ($34.74 vs $18–28 anchor)** — same turn count as display-import-source (104 vs 102) but 50% more expensive. Root cause: cache write 1h was 700.2K tokens (vs display's 237.1K) — 3× more new content written to cache. This session produced substantially more output per turn (spec depth, doc exploration) than display's design phase, despite nearly identical turn counts. Tokens/turn: sort-ts 67.9K vs display 89.3K — fewer total tokens but heavier CW tier.

- **Implement more sub-heavy than predicted** — 15 subagents (14 Sonnet, 1 Haiku) vs the predicted "few." The feature touched trends.ts (new sort utility), TrendsHashParams (URL param), TrendsModal (state, render, controls) — three logical implementation layers, driving subagent count. Still only $7.99 — Sonnet subs are cheap.

- **Review notably more expensive than prior Sonnet reviews** ($6.48 vs $3.53–$3.62 for storage/resequence). Main loop ran 132 turns over 31m with 9.75M tokens — nearly 2× the tokens of prior Sonnet reviews (5.13M/5.40M). The reviewer read through the multi-file change and a subagent. This weakens the "review is size-invariant" claim — it appears review token count tracks implementation surface, not just feature category.

- **Plan remains the most predictable phase.** 27 turns / $2.49 / 8m — squarely within prediction. Sonnet plan continues to be the lowest-variance phase in the strategy.

- **1.49× design is below the 1.8× heuristic.** When implement is cheap relative to design (this feature), the heuristic overpredicts. The heuristic's 1.8× was calibrated mostly on medium-sized features. Small features with focused implementations may sit closer to 1.4–1.5×.
