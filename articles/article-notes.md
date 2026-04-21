# Article plan — `opus-4-7-cost-analysis.md`

Working plan for the follow-up article to `comparison.md`. The article itself is drafted in `opus-4-7-cost-analysis.md` in this folder; this file tracks decisions, outline progress, and conventions so any future session can resume cleanly.

## Status

- **Title:** *Cost analysis for a feature on Opus 4.7 — why the API bill was the cheap part*
- **Filename:** `opus-4-7-cost-analysis.md`
- **Target platform:** GitHub-rendered markdown in `sans_learning/ai/claude-code-model-comparison/` (sibling to `comparison.md`); LinkedIn long-form post after publishing.
- **Final destination (files that move together):** this plan, `cost-acubemy-import.md`, and `opus-4-7-cost-analysis.md` all move from `sans_cube/` → `sans_learning/ai/claude-code-model-comparison/` when the article ships.

## Series positioning

Part 2 of a two-article series:

- **Part 1 — [`comparison.md`](https://github.com/SansWord/sans_learning/blob/main/ai/claude-code-model-comparison/comparison.md)** (published): same feature, different models (Sonnet 4.6 vs Opus 4.7).
- **Part 2 — this article:** same model, different feature sizes. Holds Opus 4.7 constant across a ~5-point feature (freeform) and a ~16-point feature (acubemy-import).

Together they triangulate two axes of AI-assisted cost: model choice and feature size.

## Purpose

- **Audience:** devs / AI-power-users interested in concrete, honest cost breakdowns of real AI-assisted feature work.
- **Goals (priority order):**
  1. Share publicly, help others reason about real cost of AI-assisted development.
  2. Build reputation over time.
  3. Hiring interest is a bonus, not the optimization target.
- **Non-goals:** hiring-manager skim-pull, viral framing, clickbait.

## Relationship to `cost-acubemy-import.md`

- The cost doc is **evidence** — descriptive numbers, caveats, no recommendations.
- This article is **narrative** — motivation, teachable insight, craft observations, one "what I'd do next" line.
- Cite the cost doc as the data appendix; don't re-derive numbers.

## Thesis (locked)

- **Opening pivot:** engaged time is a cost, not an output.
- **Structural spine:** on the same model, API dollars scale roughly linearly with output; your attention scales super-linearly with complexity. Per-point numbers: **$14.6 → $15.4 (1.06× flat dollars)** and **6.7 min → 19.8 min (2.95× super-linear time)**.
- **Punchy sub-section:** subagents aren't about parallelism — they're about **cheaper tokens + cleaner review**. (Replaces earlier "parallelizes Claude, not you" framing, which was inaccurate for Superpowers' sequential per-task pattern.)
- **Closing stinger:** writing this analysis cost ~$56 — about 23% of the $247 feature it analyzes.

## Four takeaways (the pruning test — cut anything that doesn't support one)

**Two practices I'll keep doing:**

1. **Multi-phase with clean context between phases.** The `/exit`-and-relaunch discipline from my global `CLAUDE.md`, snippet inlined as `<details>` in section 3.
2. **Subagent delegation.** Cost routing to Haiku (mechanical) + clean-context peer-review effect (judgment).

**Two methods introduced to readers:**

3. **Story points as cross-feature yardstick.** Imperfect but sprint-familiar; makes same-model/different-size comparison defensible at N=2.
4. **Ask Claude to analyze session JSONLs.** Reusable prompt shipped in the takeaways section (section 8) as a copy-pasteable block.

**One untried suggestion (flagged, not a takeaway):**

- Deliberate Opus → `/clear` → Sonnet main-loop hybrid. Counterfactual math: ~35% savings on this feature. N=0 from me.
- **Draft one-liner for section 7 (Takeaways):**
  > **One untried.** A deliberate Opus (brainstorm + plan) → `/clear` → Sonnet (execute) hybrid would likely save ~35% on a feature this size ([see comparison.md](https://github.com/SansWord/sans_learning/blob/main/ai/claude-code-model-comparison/comparison.md#hybrid-worth-trying-next-time)). I didn't run it. I'll try it on the next 10+ point feature and report back.

## Outline + drafting progress

| # | Section | Status |
|---|---|---|
| 1 | **Opening** — italic tagline + intro paragraph; engaged-time reframe; references `comparison.md` | ✅ Drafted |
| 2a | **Project context** — what `sans_cube` is (verbatim from `comparison.md` for series continuity) | ✅ Drafted |
| 2b | **The feature and why I built it** — 3 reasons: SSoT, Roux LSE breakdown (`CMLL + EO + (UR+UR) + EP`), backend-engineer curiosity about user-facing migration | ✅ Drafted |
| 3 | **Setup: same model, three clean-context sessions** — three-phase pattern, Superpowers named once as plugin + framed as pattern, `CLAUDE.md` snippet in `<details>`, H3 on why Opus 4.7 | ✅ Drafted |
| 4 | **Headline numbers** — $247 / ~46% plan-limit / ~5h 16m engaged; brief tease of method #4 (cost-analysis prompt) | ✅ Drafted |
| 5 | **Cost per story point — dollars held, attention didn't** — per-point table (incl. totals); introduces story points as the comparison unit; folds in a one-sentence scope-of-work (parser / schema transform / tests / UI + exception handling) | ✅ Drafted |
| 6 | **Why delegate: cheaper tokens, cleaner review** — cost routing beat ($35 saved via Haiku) + clean-context review beat with two concrete catches (Task 7 type narrowing + Task 2 importedFrom field). Distinguishes automatic hybrid (Superpowers' agent-default routing) from deliberate main-loop hybrid | ✅ Drafted |
| ~~7~~ | ~~Hybrid-mode counterfactual — entire section inside `<details>`~~ | ❌ Cut (folded into §7 one-liner) |
| 7 | **Takeaways — two practices, two methods, one untried** — reusable cost-analysis prompt in `<details>`; "one untried" broadened to three model-mixing variants (closes with an invitation, no personal promise) | ✅ Drafted |
| 8 | **The meta-cost** — recursion paragraph closing with subtitle callback ("The API bill was the cheap part here too"). Numbers left as `[TBD]` placeholders; filled in after full review + TL;DR | ✅ Drafted (numbers pending) |
| — | Bottom nav: `← [Back to Index](../../README.md)` | ✅ Done |

## Decisions already made (don't re-litigate)

- **Naming Superpowers:** one explicit plugin mention + link in section 3, rest of article frames as "three-phase pattern" or similar. Not full plugin promotion; not plugin-anonymized either.
- **Reason #3 in section 2b:** "curiosity" framing (backend engineer exploring user-facing migration UX), not "lower migration friction for other users" (felt too ambitious for the article's modest tone).
- **Roux differentiator:** call out the specific sub-phase split `CMLL + EO + (UR+UR) + EP` as sans_cube's LSE breakdown vs Acubemy's.
- **Scope-of-work list:** moved out of section 2 (too detailed there); folded into section 5 as one grounding sentence when introducing "16 points."
- **Story-point "13 → 16" calibration story:** de-emphasized. Story points are methodology (cross-feature yardstick), not a self-correction anecdote.
- **Subagent reframe:** cost + correctness, not parallelism. Sequential per-task review in `subagent-driven-development` made the parallelism claim inaccurate.
- **Automatic vs deliberate hybrid:** the article distinguishes them. Automatic ($35 saved via Superpowers routing subagents to Haiku by default) already happened; deliberate (main-loop Opus → `/clear` → Sonnet) is untried.
- **Hybrid-mode section:** cut as a standalone section. Overclaim risk (N=0) + pruning test said it wasn't a takeaway. Folded into section 7 (Takeaways) as the "one untried" line; section 6's tail rephrased so it no longer points forward to a hybrid section.
- **Meta-cost:** closing stinger, not opener or footnote.
- **Link policy:** absolute GitHub URLs for narrative cross-references likely to be quoted on LinkedIn (e.g., `comparison.md`); relative links for in-folder navigation (`../../README.md`, `./sans_cube.png`, `./comparison.md` in the nav line).

## Voice and conventions (matched to `comparison.md`)

- Italic tagline between H1 and nav line.
- `← [Back to Index](../../README.md)` at both top and bottom of article.
- **"My take"** callouts after analytical paragraphs — use the user's direct chat language, lightly cleaned for grammar, not paraphrased into something blander.
- Collapsible `<details>` blocks for evidence/caveats readers can skip (handoff-snippet copy-paste in section 3).
- Absolute GitHub URLs for cross-article narrative references; relative links for in-folder files.
- No emojis in the article body (follow project convention).

## What NOT to do

- Don't merge the cost doc into the article. Separate artifacts.
- Don't strip hedges/caveats to sound authoritative. N=2, one author, post-hoc analysis — these are differentiators, not weaknesses.
- Don't over-optimize for hiring-manager skim (bold pull-quotes, punchy decision signals). Undermines the honest-analysis positioning.
- Don't promote the Superpowers plugin — name and credit it once, then talk about the pattern.
- Don't overclaim the peer-review-via-subagent effect as *measured*. It's a plausibility argument; label it as such.
- Don't make recommendations beyond what N=2 supports. One hedged "I'd try deliberate hybrid next time" is the ceiling.

## Open decisions

All sections drafted. Outstanding before publish:
- Full review pass (voice, flow, factual accuracy).
- Add TL;DR at top — informed by the full-draft review.
  - **Structural note:** Takeaways was heavy-cut (option A) and now only holds the reusable prompt + the One-untried variants. The "2 practices + 2 methods + 1 untried" framing moves into the TL;DR — with each bullet linking back to the relevant body section (§3 for multi-phase, §6 for subagents, §5 for story points, §4 or §7 for the JSONL-analysis prompt, §7 for the untried mixing-models experiment).
  - **Content note:** include a bullet that this analysis also produced a concrete process improvement — a new Review Protocol in my personal `CLAUDE.md` that defaults review tasks to a fresh-context Agent (now shown as a `<details>` snippet in §6). Ties the article back to actionable takeaway, not just measurements.
- Fill in `[TBD]` placeholders in section 8 (meta-cost) once review + TL;DR work completes, so the recursion number is against the shipped article.
- Move trio of files (`article-notes.md`, `cost-acubemy-import.md`, `opus-4-7-cost-analysis.md`) from `sans_cube/` → `sans_learning/ai/claude-code-model-comparison/`.

---

## Drafting workflow

- Each section is drafted inline in the conversation, reviewed, then appended to `opus-4-7-cost-analysis.md` via `Edit`.
- This plan file gets updated as decisions lock or the outline changes.
- If the conversation compacts or ends mid-draft, the next session can resume from `opus-4-7-cost-analysis.md` (authoritative draft) + this plan (context and remaining work).

## Starter prompt for a new session (if this one dies)

Paste into a fresh Claude Code session to resume drafting:

> I'm drafting a public article at `opus-4-7-cost-analysis.md` — a follow-up to the already-published `comparison.md` in `sans_learning/ai/claude-code-model-comparison/`. The working draft and planning file both live in `sans_cube/` for now (will move to `sans_learning/` together with `cost-acubemy-import.md`).
>
> Read first, in order:
> 1. `article-notes.md` (this file) — the plan. Contains title, thesis, outline with drafting progress, locked decisions, and conventions.
> 2. `opus-4-7-cost-analysis.md` — the working draft. Sections already written appear above the HTML outline comment near the bottom of the file.
> 3. `cost-acubemy-import.md` — the data appendix (evidence for the numbers).
> 4. `comparison.md` at `/Users/sansword/Source/github/sans_learning/ai/claude-code-model-comparison/comparison.md` — voice/style reference; part 1 of the series.
>
> Then resume at the next `⬜` section in the plan's outline table. Draft iteratively — one section at a time — updating both files as each section locks.
