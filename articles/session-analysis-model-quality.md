# Does the cheaper model actually do the work? A session-level quality analysis

The [model strategy comparison](cost-comparison-model-strategy.md) showed that using Sonnet for plan, implement, and review instead of Opus cuts total feature cost by ~35–45%. But cost numbers don't answer the harder question: is anything lost?

To find out, I read the actual session JSONL files for three phases across two features — the resequence-panel (Sonnet plan) and the storage-module (Sonnet implement + Sonnet review) — and compared implementation behavior between the all-Opus acubemy-import session and the Sonnet storage-module session.

---

## Methodology

Claude Code stores every turn of every session as a JSONL file at `~/.claude/projects/<project-id>/<session-id>.jsonl`. Each line is a JSON event — `user` turns, `assistant` turns, tool calls, tool results, subagent invocations. Subagents get their own JSONL files in a sibling `subagents/` directory.

For each session, I looked at:
- What tasks the model planned and whether implementation followed them
- Where the model deliberated vs. acted immediately
- Whether review sessions ran real verification or produced surface-level approval
- What issues were flagged and whether they were genuine

The sessions analyzed:

| Session | File |
|---------|------|
| resequence plan (Sonnet) | `e2b61266-…-24835d8f4670.jsonl` |
| resequence implement (Sonnet) | `204c300b-…-c6e1c498b4a2.jsonl` |
| resequence review (Sonnet) | `9cec2b3c-…-24457b616427.jsonl` |
| storage implement (Sonnet) | `260ce4df-…-4dd43845d42c.jsonl` |
| storage review (Sonnet) | `a2376d12-…-4ffdfb664.jsonl` |
| acubemy implement (Opus) | `6994d6a2-…-f723b.jsonl` |

---

## Plan quality: Sonnet

The resequence-panel plan was written by Sonnet — the first feature in this dataset where the expensive model was not used for planning. The plan covered 8 tasks (~25 checkboxed steps), a file map (9 files: 4 create, 5 modify), a scope coverage self-check table mapping every spec requirement to a task, and explicit integration callouts.

Notable preemptive callouts in the Sonnet-generated plan:
- Specified exact line numbers in the files to be modified
- Called out the `React.CSSProperties` namespace import trap explicitly — a common refactor pitfall
- Noted the counter update ordering constraint (must update _after_ bulk writes)
- Flagged that the Firestore function has no unit tests (deliberate; covered by manual QA only)

**Implementation fidelity:** All 8 tasks were executed in exact plan order. No plan items were skipped or modified. No mid-course corrections were needed due to plan ambiguity.

The only rework in the session was two instances of a subagent accidentally writing to `main` instead of the feature branch worktree — an infrastructure bug, not a plan quality problem. The main loop caught both incidents itself.

Approximate turn breakdown: ~30 clean execution turns, ~7 correction turns (all worktree incidents), ~40 coordinator assistant turns total.

**Verdict: the Sonnet plan was indistinguishable from what an Opus plan would have produced.** The technical design — interfaces, state machine shape, component props, commit callback — was used as-written with no corrections. The 1.38M-token Sonnet plan (vs 4–6M tokens for Opus plans on comparable features) delivered equivalent guidance at ~5× lower cost.

---

## Review quality: Sonnet

Both storage-module and resequence-panel reviews ran on Sonnet. Neither review was rubber-stamping.

### What the reviewers actually did

Both review subagents ran real verification commands: `npm run test`, `npm run build`, targeted `git show` and `grep` calls to verify specific claims. They did not just read the diff and summarize — they checked the implementation against the plan's self-review checklist item by item.

### What they found

**Storage-module review:**
- **Dead state (`detectingMismatches`)** — The handler set a loading flag to `true`, did synchronous detection, then set it back to `false` in the same event. React batches these, so the "Detecting..." label never renders. The reviewer identified _why_ it was dead — the code had migrated from async Firestore reads to synchronous detection, and the flag was vestigial. Not a bug, but confusing code, and the reasoning required understanding the migration history.
- **Naming inconsistency** — `export const _internal = { setState, notify }` only used in one test, while the existing test-only helper was named `__resetForTests`. Real inconsistency, correctly identified.
- **Spec typo** — The spec said `onProgress` fires 4 times for 250 draft solves; the correct answer is 3 (3 chunks → 3 calls). The reviewer cross-referenced spec against plan against implementation, concluded the spec was wrong and the implementation was right.
- **Beneficial deviations documented** — Three places where the implementation did something better than the plan specified, with explanations of why.

**Resequence-panel review:**
- **Implicit `undefined` behavior** — In `previewRenumberScope` and `renumberSolvesInFirestore`, the comparison `s.seq !== i + 1` evaluates to `true` when `seq` is `undefined` (because `undefined !== number` in JavaScript), so old imported solves without a `seq` field get renumbered correctly. The behavior is right but implicit, and no test covered the undefined-seq path. This required knowing the JS type coercion rule and recognizing it as an untested assumption.
- **Progress flash** — `ResequenceScopePanel` initializes at `{ batch: 0, total: 0 }`, which could briefly show "batch 0 of 0" before the first `onProgress` fires. Matched the spec, but called out as a UX edge case.
- **`future.md` housekeeping** — Correctly flagged that the resequence item hadn't been crossed off yet.

Neither review required post-review code changes — both features shipped clean. But the issues found were specific and reasoned, not generic observations.

**Important caveat:** both features had explicit self-review checklists in their plans. That structure likely scaffolded the reviewer's work — it told the reviewer what to check. A feature with a vaguer plan might expose a lower ceiling for Sonnet review.

**Verdict: Sonnet review is substantive for well-specified features.** The dead-state identification required reasoning about async→sync migration history. The undefined-seq observation required JS type knowledge and recognizing an untested implicit assumption. These are not surface-level findings.

---

## Implementation behavior: Opus vs. Sonnet

Comparing the acubemy-import (Opus) and storage-module (Sonnet) implementation sessions directly.

### How each model read the plan

**Opus** read the plan in four separate chunks (the plan was too large for a single read), then explicitly acknowledged "I have the full plan" before doing anything. It also checked whether a worktree existed, ran baseline tests, and noted "Baseline clean: 339 tests passing" before dispatching any subagent.

**Sonnet** loaded the plan in a single read, noted "The plan looks solid — 16 tasks, TDD throughout, clean architecture" (a value judgment), and started the worktree setup without hesitation. It also confirmed a baseline, but more compactly.

Both read the plan before writing a line of code. Neither dove straight in.

### Mistakes and self-correction

**Opus** had one significant coordination failure. A subagent committed to `main` instead of the feature branch. Opus detected this itself immediately after checking the git log: "Critical issue — the Task 2 subagent committed on main (somehow) instead of the feature branch." It self-diagnosed, cherry-picked the commit onto the feature branch, then explicitly invoked the safety rule before asking permission: "Per your global rule, I won't reset without your consent." After the incident, it visibly tightened its subagent prompts to include stronger worktree path instructions.

**Sonnet** had no equivalent coordination failure in the storage session. It did receive reviewer feedback on implementation quality (rollback should use a pre-snapshot, a test was missing a listener removal check) and dispatched fix agents. These were normal review-cycle corrections, not mistakes.

### Deliberation style

**Opus** deliberated visibly on ambiguous decisions. When a reviewer flagged a potential issue with `importedFrom` being removed, Opus ran its own `git diff --stat` independently to verify the claim before accepting or rejecting it. When the user asked whether to commit a data directory, Opus laid out three labeled options (A/B/C) with pros and cons before acting.

**Sonnet** was compressed. When a reviewer flagged the rollback pre-snapshot issue, Sonnet's response was "Medium quality issue to fix" and it dispatched the fix agent immediately — no deliberation, just action. It accepted reviewer findings at face value without independent verification.

Both behaviors were appropriate given that reviewer findings _were_ accurate. But Sonnet's pattern represents a risk: if a reviewer flags a false positive or misdiagnoses an issue, Sonnet is more likely to act on it without checking.

### Proactive integration awareness

Both models proactively checked that integration seams existed before dispatching wiring tasks. Opus grepped for required Firestore helpers before writing Task 12. Sonnet verified that all `firestoreSolves` exports were present before a verification task, and checked for zero remaining `useSolveHistory` imports before deleting it.

No meaningful difference here.

| Dimension | Opus (acubemy) | Sonnet (storage) |
|-----------|---------------|------------------|
| Plan reading style | Thorough, multi-chunk, explicit acknowledgment | Single-read, immediate value judgment |
| Coordination errors | One wrong-branch commit — self-detected, self-corrected | None observed |
| Deliberation | Lays out options on ambiguous decisions | Compressed — acts quickly after brief assessment |
| Reviewer verification | Independently verified suspicious findings before acting | Accepted reviewer output, dispatched fixes |
| Proactive integration checks | Yes — grepped for APIs before wiring tasks | Yes — similar pattern |
| Safety behavior | Explicit rule invocation before destructive ops | Standard protocol compliance |

**Verdict: Sonnet implementation works but is less deliberate.** On well-specified features with accurate reviewers, this doesn't matter — Sonnet produced clean output, 16 tasks completed, all reviews passed. The reduced deliberativeness becomes a risk on features with ambiguous specs, inaccurate reviewer feedback, or novel integration points where "act first" can be costly.

---

## Synthesized view: what does model choice actually affect?

Across design, plan, implement, and review, the session-level evidence maps onto three dimensions:

**Reasoning depth** — Opus reasons visibly about ambiguous decisions. Sonnet reasons compressed or skips to action. This matters most in design (high ambiguity) and least in implement (well-specified by the plan).

**Verification behavior** — Opus independently double-checks claims before acting. Sonnet trusts and acts. This matters most in implement (where subagent outputs could be wrong) and in review (where findings should be verified before spawning fix agents).

**Output quality** — Both models produce correct, usable outputs for plan, implement, and review on well-specified features. No observed quality gap in final artifacts.

The implication is that model choice primarily affects **process robustness**, not **output quality** — at least on features of this complexity and specification quality. Opus is safer when things go sideways. Sonnet is sufficient when the path is clear.

---

## Updated model strategy

| Phase | Model | Confidence | Reasoning |
|-------|-------|------------|-----------|
| Design | **Opus** | — (no comparison data) | Architecture decisions, integration point identification, design tradeoff reasoning — the one phase where depth of reasoning directly affects artifact quality |
| Plan | **Sonnet** | High | Verified: Sonnet plan followed verbatim, preemptive callouts accurate, zero quality gaps. ~5–10× cheaper. |
| Implement | **Sonnet + Haiku subs** | Medium-High | Verified: clean output on well-specified features. Risk: less deliberation on ambiguous situations. Haiku subs for mechanical tasks. |
| Review | **Sonnet** | Medium-High | Verified: substantive reviews that require real reasoning. Risk: quality correlates with how well the plan structured the self-review checklist. |

**What would move confidence higher:**
- A feature using Sonnet for design, to test whether Opus is actually necessary there
- A review of a feature with a vague plan (no self-review checklist), to test Sonnet review without scaffolding
- A feature where an implementation ambiguity arises, to see if Sonnet's reduced deliberativeness causes a real error

---

*Related: [Model strategy cost comparison](cost-comparison-model-strategy.md) — dollar-cost breakdown across the same features*

*N=2–3 features, same project, one author. Session-level findings are suggestive, not statistically robust.*
