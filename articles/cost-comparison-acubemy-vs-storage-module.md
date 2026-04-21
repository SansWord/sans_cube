# Design-to-Implementation Cost Ratio: acubemy-import vs storage-module

Two features, same workflow (Superpowers design → plan → implement), different implementation models. This doc checks one hypothesis and surfaces one surprise.

## The features

| | acubemy-import | storage-module |
|---|---|---|
| Design model | Opus 4.7 | Opus 4.7 |
| Plan model | Opus 4.7 | Opus 4.7 |
| Implement model | Opus 4.7 | Sonnet 4.6 |

## Phase costs

| Phase | acubemy-import | storage-module | Ratio (acubemy / storage) |
|-------|---------------|----------------|--------------------------|
| Design | $103.54 | $25.42 | 4.07× |
| Plan | $27.87 | $14.99 | 1.86× |
| Implement (+Review) | $115.49 | $27.72 | 4.17× |
| **Total** | **$246.90** | **$68.13** | **3.62×** |

---

## Hypothesis: design cost predicts implement cost

The intuition: a heavier feature needs more design work, and that same complexity shows up in implementation. So design cost and implement cost should scale together.

**Implement-to-design ratio:**

| Feature | Implement cost | Design cost | Ratio |
|---------|---------------|-------------|-------|
| acubemy-import (Opus implement) | $115.49 | $103.54 | **1.115×** |
| storage-module (Sonnet implement) | $27.72 | $25.42 | **1.091×** |

The ratio is nearly identical — roughly **1.1× in both cases**.

This supports the hypothesis: the design-to-implement relationship is stable, and the cost is primarily driven by feature scope, not model choice.

---

## Does using Sonnet for implement change the ratio?

Not meaningfully. Storage-module's implement phase used Sonnet 4.6 (5× cheaper per token than Opus 4.7), yet the implement/design ratio barely moved — 1.091 vs 1.115. The absolute dollar savings are real (~4× cheaper implement), but they scale proportionally with feature size, not in a way that distorts the ratio.

**Conclusion:** Switching to Sonnet for implementation makes the whole feature cheaper in proportion to its design cost. It doesn't compress or inflate the implement phase relative to design. The ratio stays at ~1.1× regardless of model.

This is a useful planning heuristic: **budget ~1.1× your design cost for implementation**, independent of whether you run implementation on Opus or Sonnet.

---

## Surprise: plan cost scales less than the other phases

Design and implement both scaled ~4× between the two features. Plan scaled only **1.86×** — roughly half as much.

| Phase | Scale factor |
|-------|-------------|
| Design | 4.07× |
| Plan | 1.86× |
| Implement | 4.17× |

One possible explanation: planning is a more mechanical phase — it converts the design doc into a structured task list. The complexity of that conversion grows more slowly than the underlying feature complexity, because a plan is inherently compressed (checkboxes, not prose). A 4× larger feature doesn't produce a 4× longer plan; the plan format absorbs the growth.

Another way to read it: **plan cost doesn't reliably predict feature size**. Design and implement do. If you only looked at plan cost across features, you'd underestimate how much larger acubemy-import was.

---

## Summary

1. **Design cost ≈ implement cost** (ratio ~1.1×), and this holds across both features regardless of implementation model.
2. **Sonnet for implement saves money proportionally** — it doesn't distort the design-to-implement ratio, it just scales the whole budget down.
3. **Plan cost is compressed** relative to feature size. It's a poor predictor of total cost; design cost is the better anchor.

*N=2, same project, one author. The ratios are suggestive, not statistical.*
