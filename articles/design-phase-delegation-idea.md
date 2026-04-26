# Design-Phase Delegation — Idea, Not Yet Applied

**Status:** Idea captured; not currently applied in project CLAUDE.md or any workflow.
**Captured:** 2026-04-23
**Would apply to:** `superpowers:brainstorming` and `superpowers:writing-plans` sessions.

---

## The idea

Keep the main loop on Opus (or Sonnet) for design-phase reasoning, but offload mechanical work — file reads, grep, verification lookups, doc summarization — to cheaper-model subagents via the `Agent` tool's `model` parameter.

Superpowers `brainstorming` and `writing-plans` skills do not delegate by default; both run entirely in whatever main-loop model is selected. This would be a project-layer addition on top of their normal flow.

## Delegation tiers (proposed)

**Delegate to Haiku subagent:**
- Reading + summarizing existing docs, specs, or components (batch into one call when possible)
- Grep/find across the codebase for symbols, patterns, usages
- Verification lookups ("does function X exist?", "is Y still imported?")
- Listing files that match a pattern

**Delegate to Sonnet subagent:**
- "How does X currently work?" exploration that requires light comprehension across 3+ files
- Extracting key constraints or decisions from a long doc
- Any lookup that needs filtering/judgment but not design reasoning

**Keep in main loop:**
- Asking the user clarifying questions
- Weighing tradeoffs between design options
- Drafting the final spec or plan document
- Any turn where the output IS the reasoning, not a lookup

## Rules of thumb

- **Batching rule:** If multiple lookups are known upfront, combine them into one subagent call to amortize startup overhead. Example: `Agent(model="haiku", "Read and summarize: fileA, fileB, fileC. For each: purpose, key exports, relevance to [feature]. Under 600 words.")`
- **Timing rule:** Don't delegate blind exploration before forming hypotheses. First let the main loop read the user's request and identify what to look for, *then* delegate targeted lookups. Otherwise the subagent produces summaries that miss the point and the main loop re-reads the files anyway.
- **Main-loop tier matters:**
  - **Opus main loop** → aggressive delegation pays off (~15–20× token-rate differential vs. Haiku).
  - **Sonnet main loop** → selective delegation only; savings are ~3–4× per task. Worth it for batched reads, large greps, long-doc scans. Not worth it for a single short file read.
  - **Haiku main loop** → skip delegation entirely.

## Why it was not applied

The strategy trades design quality for cost in ways that are hard to detect at authoring time. Specifically:

1. **Raw-content curiosity chains break.** When Opus reads a file directly, it often notices something mid-read that triggers a follow-up ("this imports X, let me check how X handles that"). With a Haiku summary, that chain is severed — Opus reasons over a flattened description, not raw code. Summaries reflect what Haiku thought mattered, not what Opus would have noticed.

2. **Silent misframing risk.** If Haiku slightly mischaracterizes a pattern ("uses a reducer" when it's actually a custom hook), Opus builds on that wrong foundation without verifying. Opus's reasoning stays internally consistent with the (wrong) summary. You don't see the error.

3. **Cross-file pattern recognition weakens.** When Opus reads 4 files in sequence, it notices architectural cues that span them: shared naming conventions, subtle coupling, repeated workarounds. A batched "here are 4 summaries" loses the cross-file signal because each file was abstracted independently before Opus saw any of them.

4. **Verification fidelity drops.** "Does function X exist?" from Haiku → yes/no. Opus reading directly → "exists but deprecated" / "exists but only called from one legacy path" / "exists but shadows a newer version". The extra context often matters for design.

**Where it's neutral or positive:**
- Reasoning quality itself is unaffected — design thinking and spec drafting still happen in Opus.
- Context pollution is reduced — summaries keep Opus's context denser in signal for long sessions.
- The timing rule forces explicit hypothesis formation, which is good discipline.

**Feature-type sensitivity (rough estimate):**

| Feature type | Quality impact |
|-------------|----------------|
| Well-bounded, CRUD-like, clear scope | Negligible — summaries are sufficient |
| New component in an established pattern | Negligible — just needs existing-pattern summary |
| Cross-cutting refactor touching many files | Meaningful loss — cross-file cues matter |
| Architectural decisions (new layer, new abstraction) | Meaningful loss — subtle code cues inform tradeoffs |
| Performance / correctness-sensitive design | Risky — silent Haiku misframing can derail design |

Rough calibration: ~70% of feature work in this project is the first two categories (negligible quality impact). ~30% is the latter three (meaningful loss).

## Mitigations that would mostly close the gap (if revisited)

1. Tell subagents to include **verbatim excerpts** (10–20 lines) of anything non-obvious, not just paraphrases. Opus then reasons over real code for the load-bearing parts.
2. Ask subagents to explicitly **flag "anything unusual or surprising"** — surfaces things a pure summary would smooth over.
3. Let Opus **request raw content on specific files** when a summary raises questions — treat summaries as a first pass, not a final answer.
4. For architectural or cross-cutting features, **bypass the strategy entirely** — read key files directly in the main loop.

## Related constraints from Claude Code's Agent tool

- Each `Agent(...)` call is a fresh invocation; there is no persistent Haiku worker to amortize startup across many calls. `SendMessage` can continue an already-running agent, but not act as a long-lived queue.
- Subagent startup re-sends system prompt + CLAUDE.md + memory index + conversation context. For short tasks that overhead can exceed the model-rate savings.
- Batching multiple chores into one subagent call is the practical way to amortize.

## If revisited later

Things to validate before re-adopting:

1. Run one design session with the strategy vs. one without on comparable features; compare final spec quality, not just cost.
2. Decide whether "verbatim excerpts + unusual-flag" mitigations are enough to preserve architectural-judgment quality.
3. Set an explicit escape clause in CLAUDE.md ("for cross-cutting or architectural features, skip delegation").
4. If re-adopted, add it as a tracked data point in [`cost-comparison-model-strategy.md`](cost-comparison-model-strategy.md) and [`experiment-overview.md`](experiment-overview.md).

For now: kept as an idea, not a practice.
