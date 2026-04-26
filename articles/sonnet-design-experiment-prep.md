# Sonnet-Design Experiment — Pre-Session Notes

Prep file for running a deliberate **Sonnet-design** session on a known-scope feature, to test the "Opus deliberation floor" hypothesis from [`cost-comparison-with-turns.md`](cost-comparison-with-turns.md).

**The claim being tested:** all four Opus design sessions landed at 86–329 turns. Display-import-source (a pill badge) still used 102 turns. Is that a property of the feature, or a property of Opus? A Sonnet-design on a comparable feature should answer: if Sonnet also lands near the anchor, turns track complexity; if it lands dramatically lower *and* the spec covers the same decisions, there's a real Opus deliberation floor.

---

## Primary experiment — Feature #1: Sort-by-timestamp toggle in Trends

Backlog entry: `future.md` Statistic section — *"Sort-by-timestamp toggle in Trends: normalize the backward time-jump in the chart after an import by offering a sort mode that orders by cubeTimestamp instead of solve seq."*

### Predicted design decisions (enumerate BEFORE the session)

Writing these down upfront is the control. After the session, compare what the Sonnet spec covered against this list. Coverage is the quality signal; turn count is the cost signal.

1. **Toggle placement** — where does the sort-mode control live in the Trends UI? (top bar next to existing filters? inside a settings menu? next to the chart itself?)
2. **Default mode** — does Trends default to seq (current behavior, preserves existing UX) or cubeTimestamp (arguably more correct after imports)?
3. **Persistence** — is the user's choice persisted in localStorage, or reset per session?
4. **Scope of the toggle** — does it only affect Trends, or should it also affect the sidebar solve list / other views that use seq ordering?

*(Not-decisions: implementation details like effect wiring, URL param handling, and exact storage key are implementation-phase concerns.)*

### Expected integration surface

- `src/components/TrendsModal.tsx` — primary
- Possibly `src/hooks/` — if a new hook is extracted for the toggle state
- Possibly a new localStorage key in `docs/storage.md`
- `docs/trends-zoom.md` or `docs/ui-architecture.md` — documentation touch

### Sibling anchor

**[display-import-source](cost-display-import-source.md)** — 102 design turns, $23.18, 37m 50s engaged, all Opus. Similar "small UI addition with a taxonomy-ish decision" complexity class.

### Expected turn range

| If ... | Predicted design turns |
|---|---|
| Sonnet behaves feature-driven (matches anchor) | 70–120 |
| Sonnet has a lower deliberation floor than Opus | 35–55 |
| Sonnet rabbit-holes or gets lost | 150+ (unlikely on a scope this tight) |

### Measurement at end of session

Record in the per-feature cost file:

- Design turns (from `scripts/cost_extract.py`)
- Design cost (from script)
- Tokens/turn (derived)
- **Decision coverage:** check the Sonnet spec against the 4 predicted decisions above. Count hits / misses / unexpected-raised.
- **Unexpected decisions:** anything the spec raised that wasn't in the predicted list (Sonnet finding something worth discussing). Not a bad thing — informative.
- **Unexplored decisions:** predicted decisions the spec didn't address (possible miss; needs manual follow-up).

---

## Follow-up experiment — Feature #2: Ao5 / Ao12 for phases

Only run this if Feature #1 lands cleanly. Two Sonnet-design data points on known-scope features lets the turns doc move from speculation ("Sonnet might skip things") to measurement.

Backlog entry: `future.md` Statistic section — *"ao5, ao12 for phases?"*

### Predicted design decisions

1. **Display location** — extra rows in the existing stats panel, a new tab, or inline toggles? (How does it coexist with the Total/Exec/Recog dimension from v1.5?)
2. **Which phases included** — all phases, or excluding whole-solve?
3. **Interaction with existing toggles** — when the user has "Exec" selected, do ao5/ao12 follow that selection or have their own toggle?
4. **Edge case** — what happens when a phase time is missing for some solves in the window? (Skip the solve? Drop the stat? Show partial?)

### Expected integration surface

- Stats computation module (wherever ao5/ao12 for whole-solve is computed today)
- Stats display component
- Possibly `TrendsModal` if phases ao5/ao12 should also chart

### Sibling anchor

**[resequence-panel](cost-operation-resequence-panel.md)** — 86 design turns, $19.27, 31m 30s engaged. Similar "extend an existing UI with a new dimension" shape.

### Expected turn range

| If ... | Predicted design turns |
|---|---|
| Sonnet feature-driven | 80–120 |
| Sonnet has a lower deliberation floor | 40–60 |
| Sonnet skips the edge-case decision (most likely miss) | 50–70 with incomplete spec |

The edge-case decision (missing phase times) is the test — if the spec doesn't address it, that's the kind of miss the strategy doc warned about.

---

## Execution checklist

When ready to run the experiment:

- [ ] Open this file at session start as the control
- [ ] Switch Claude Code to Sonnet 4.6 before starting the design session
- [ ] Name the session `{feature} - design` so `cost_extract.py` picks it up
- [ ] Run the standard `superpowers:brainstorming` → spec workflow — **do not change the process**, only the model
- [ ] After the session, run `scripts/cost_extract.py --label design <session>`
- [ ] Fill in the decision-coverage table in the feature's cost file
- [ ] Append a data point to `cost-comparison-model-strategy.md` flagging this as the first non-Opus-design feature
- [ ] Update `cost-comparison-with-turns.md` with the new observation about the deliberation floor (confirmed / refuted / inconclusive)

---

## What this experiment can and can't prove

**Can prove:** whether Sonnet-design's turn count on a comparable-scope feature is meaningfully lower than Opus-design's. That's the one testable claim.

**Cannot prove:** whether Sonnet's spec is "as good as" Opus's in the abstract. You're judging the spec against a pre-registered decision list — coverage is concrete, but a spec can have full coverage and still be shallower. Keep expectations calibrated: one Sonnet-design feature adds one data point, not a verdict.

**Cannot prove:** that Sonnet-design generalizes to unknown-scope features. This experiment specifically picks features where scope is known. Unknown-scope features are where Opus's deliberation is most likely to pay off, and this experiment won't speak to them.

*N=0 Sonnet-design features today. Target: N=2 after this experiment.*
