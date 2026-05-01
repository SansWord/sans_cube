# Cost: Public Sharing Without Cloud Sync

**Shipped:** 2026-05-01 (v1.31.0)

Feature: Share button works for any user — silent `signInAnonymously()` on first share, anon UID provisioned and persisted in Firebase IndexedDB. Anonymous users blocked from cloud sync. Visible error toasts on share/unshare failure. Three new test files covering the anon path.

Workflow: design → plan → implement (**no review session — 3-phase shipping**).

**Strategy: Opus D, Sonnet P+I** (subset of recommended strategy — review skipped this feature).

**Design kick-off prompt** *(pre-framed prompt — referenced a `handoff.md` that contained full design decisions, tradeoffs, and an implementation sketch):*
> "Start brainstorm the work described in handoff.md"
>
> *(`handoff.md` was a pre-written design doc by the user covering: goal, "Anonymous Firebase Auth on Demand" approach, why this approach, accepted tradeoffs, decisions explicitly NOT made, and a 4-section implementation sketch across `useCloudSync.ts` / `App.tsx` / `TimerScreen.tsx` / Firestore rules. The brainstorming session refined and formalized this into the committed spec.)*

**Sessions:**

| Phase | UUID |
|-------|------|
| design | `e7213bd6-ef58-491e-a085-1681966583fe` |
| plan | `7cc641fc-2453-4a55-95f5-bb9b6c24d348` |
| implement | `24e6e81a-bce0-425a-8da0-36cb66c97183` |

---

## design

**Model:** claude-opus-4-7  |  **Engaged:** 30m 10s  |  **Subagents:** 0

| Token type  | Count |
|-------------|-------|
| Input             | 234 |
| Output            | 54.8K |
| Cache read        | 6.19M |
| Cache write 5m    | 0 |
| Cache write 1h    | 246.1K |
| **Total**        | **6.49M** |
| Turns           | 87 |

**Cost estimate:** $20.78  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*

---

## plan

**Model:** claude-sonnet-4-6  |  **Engaged:** 14m 18s  |  **Subagents:** 0

| Token type  | Count |
|-------------|-------|
| Input             | 71 |
| Output            | 104.5K |
| Cache read        | 2.96M |
| Cache write 5m    | 0 |
| Cache write 1h    | 185.4K |
| **Total**        | **3.25M** |
| Turns           | 64 |

**Cost estimate:** $3.57  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*

---

## implement

**Model:** claude-sonnet-4-6  |  **Engaged:** 16m 30s  |  **Subagents:** 0

| Token type  | Count |
|-------------|-------|
| Input             | 309 |
| Output            | 49.6K |
| Cache read        | 12.52M |
| Cache write 5m    | 0 |
| Cache write 1h    | 183.6K |
| **Total**        | **12.75M** |
| Turns           | 192 |

**Cost estimate:** $5.60  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*

---

## review

*Not run for this feature.* Feature shipped via the standard "ship it" flow after the implement session — manual QA via the test suite + `npm run build` + the v1.31.0 manual checklist in `docs/manual-test-checklist.md`. No separate Claude review session was opened.

This is the second feature in the dataset without a review session (the first was acubemy-import, which also shipped without a review phase). Important caveat: the "no 7-day patch" Tier-1 outcome signal is not yet observable — feature shipped today, 2026-05-01, so the soak window is empty.

---

## Summary

| label | model | total tok | input | output | cache read | cw 1h | turns | engaged | cost $ |
|-------|-------|-----------|-------|--------|------------|-------|-------|---------|--------|
| design | claude-opus-4-7 | 6.49M | 234 | 54.8K | 6.19M | 246.1K | 87 | 30m 10s | $20.78 |
| plan | claude-sonnet-4-6 | 3.25M | 71 | 104.5K | 2.96M | 185.4K | 64 | 14m 18s | $3.57 |
| implement | claude-sonnet-4-6 | 12.75M | 309 | 49.6K | 12.52M | 183.6K | 192 | 16m 30s | $5.60 |
| **total (3 phases)** | | **22.49M** | | | | | **343** | **~61m** | **$29.95** |

---

## Ratios and comparisons

| | public-sharing | sort-by-timestamp | resequence (Opus D, Sonnet P+I+R) |
|---|---|---|---|
| Design cost | $20.78 | $34.74 | $19.27 |
| Design turns | 87 | 104 | 86 |
| Plan/Design ratio | 17.2% | 7.2% | 8.7% |
| Implement/Design ratio | 27.0% | 23.0% | 54.1% |
| Total/Design ratio (excl. review) | **1.44×** | **1.30× excl. review** | **1.63× excl. review** |
| Total/Design ratio (incl. review) | — (no review) | 1.49× | 1.81× |

**Design turns 87** — *below* the ~100-turn band that short-prompt small-medium features have hit (display-import-source 102, sort-by-timestamp 104, ao5-ao12-experiment expected sibling 86 from resequence). This is the **first pre-framed Opus design** in the dataset — the user supplied `handoff.md` with all decisions enumerated, so the model formalized rather than explored. Modest 13–17 turn reduction vs short-prompt comparables. See Notes.

**Plan/Design 17.2%** — notably higher than the 7–10% Sonnet-plan band established by resequence (8.7%) and sort-by-timestamp (7.2%). 64 plan turns / 14m engaged is the highest Sonnet plan in the dataset. Likely cause: the implementation surface spans 4 files (`useCloudSync`, `CloudConfig`, `App.tsx`, `TimerScreen`) with three new test files, requiring more task decomposition than single-file features. Sonnet-plan still cheap absolutely ($3.57) but no longer always at the lower bound of the band.

**Implement/Design 27.0%** — low, similar to sort-by-timestamp (23.0%). 4 files / 192 turns in 16m on Sonnet without subagents. Subagent-free — see Notes.

---

## Outcome signals (Tier 1)

| Signal | Status |
|---|---|
| Shipped | ✅ v1.31.0, merge `ddbba32`, 2026-05-01 14:09 PT |
| No 7-day patch | ⏳ pending (shipped today; soak window empty until 2026-05-08) |
| Tests pass at ship | ✅ test suite green at merge (per project shipping discipline) |
| Review ran verification | — N/A (no review session) |

**Tier 2 verdict:** *to fill in* — see experiment-overview.md.

---

## Notes

- **First pre-framed Opus design** — the handoff.md doc enumerated the approach, accepted tradeoffs, decisions deferred, and an implementation sketch by file. The brainstorming session's job was to **formalize** this into a committed spec, not to explore the design space. 87 turns / $20.78 — below the short-prompt small-medium band (102 / 104 turns at $23–35). The reduction from pre-framing is modest (~15% turns), not dramatic. Opus still wants to walk through alternatives, ask clarifying questions, and write the spec doc carefully even when handed a complete plan. This weakens any "pre-framing massively cuts design cost" hypothesis — pre-framing trims the bottom of the turn band but does not collapse it.

- **No subagents in implement** — 0 subagents across 12.52M cache-read tokens. The four-file change touches a tightly coupled set (`useCloudSync` API → `CloudConfig` type → `App.tsx` wiring → `TimerScreen` consumer) that's hard to parallelize cleanly; Sonnet ran it as one main-loop task. Compare to sort-by-timestamp (15 subs across 3 trends files): the file count is similar but the file-coupling pattern differs. This data point suggests Sonnet's subagent-dispatch is feature-shape-driven, not file-count-driven.

- **No review session was run.** Verification ran via `npm run test` + manual checklist instead. This means the "implementation surface drives review cost" claim from sort-by-timestamp can't be tested here. It also means total feature cost ($29.95) is not strictly comparable to the four-phase recommended-strategy reference (sort-by-timestamp $51.70). Adding a hypothetical Sonnet review at the typical 11.9–18.7% of design cost would land at +$2.50–$3.90, taking total to **~$32.50–$33.85** — still the cheapest fully-tracked feature in the dataset.

- **1.44× design (3 phases) vs 1.49× sort-by-timestamp (4 phases incl. review)** — consistent with the planning heuristic. The ratio ladder for recommended-strategy features now reads: 1.30× (3 phases, sort-by-timestamp) / 1.44× (3 phases, public-sharing) / 1.49× (4 phases, sort-by-timestamp) / 1.63× (3 phases, resequence) / 1.81× (4 phases, resequence). Most of the variance lives in the implement phase, not the plan phase.

- **Smallest fully-tracked feature in the dataset.** $29.95 across 3 phases — cheaper than resequence ($34.90) which had 4 phases, and on par with what a 4-phase recommended-strategy run would cost on a similarly-scoped feature (~$33). Cost lever here was scope (4 files, no UI surface beyond toast text), not strategy choice.
