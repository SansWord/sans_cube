# New Feature Data Collection Prompt

Use this after shipping any feature that went through the full design → plan → implement → review workflow. It produces a cost breakdown file and a calibration row for `articles/cost-comparison-model-strategy.md`.

---

## How to use

1. **After `git push`** (feature is on `main`, all four phase sessions closed)
2. **Open a new Claude Code session** in this project
3. In the session, run `! cat articles/new-feature-data-collection.md` to read this file
4. **Copy the block** between `---PROMPT START---` and `---PROMPT END---`
5. **Fill in the four `[SESSION NAME]` placeholders** with the `/rename` labels you used during each phase (e.g. `"resequence panel - plan"`)
6. **Paste it as your first message** — Claude will handle the rest

**If you forgot to `/rename` a session:** give an approximate date/time instead; the script will find it by timestamp.

**Habit reminder:** always `/rename` each session before closing it, using the pattern `[feature] - design`, `[feature] - plan`, `[feature] - implement`, `[feature] - review`. That's the only manual step that makes session lookup reliable.

---

## The prompt

Copy everything between the `---PROMPT START---` and `---PROMPT END---` markers.

---PROMPT START---

I'm collecting data on this feature to calibrate model selection per phase. Please do the following in order.

## Step 1 — Identify sessions

Find the JSONL session files for these four phases by scanning `~/.claude/projects/-Users-sansword-Source-github-sans-cube/` for `custom-title` events. Report the session name and filename for each phase.

Sessions to find (fill in the names you used during `/rename`):
- design: **[SESSION NAME]**
- plan: **[SESSION NAME]**
- implement: **[SESSION NAME]**
- review: **[SESSION NAME]**

## Step 2 — Run cost_extract.py for each phase

```bash
python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  --label design "[SESSION NAME]"

python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  --label plan "[SESSION NAME]"

python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  --label implement "[SESSION NAME]"

python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  --label review "[SESSION NAME]"
```

## Step 3 — Qualitative session analysis

Read the JSONL files for plan, implement, and review. Answer these questions for each:

**Plan session:**
- How many tasks were in the plan?
- List any explicit integration risks or gotchas the plan called out
- Did the plan include a self-review checklist?

**Implement session** (sample start, middle, end — don't read the full file):
- Did implementation follow the plan task order? Any tasks skipped or reordered?
- Were there rework turns? (user corrections, "actually...", wrong output, backtrack) — count approximately
- Did the model proactively catch any integration issues not in the plan?
- Any coordination failures (wrong branch, wrong file, subagent mistake)? Self-detected or user-caught?
- Overall: clean execution or turbulent?

**Review session:**
- What specific issues did the reviewer flag? List them.
- For each: was it a real bug, a style issue, a false positive, or housekeeping?
- Did any finding require a code change?
- Did the reviewer run real verification commands (tests, build, grep) or just read the diff?
- Verdict: substantive or rubber-stamp?

## Step 4 — Produce the output file

Write a file `articles/cost-[FEATURE-NAME].md` with this structure:

```
# [Feature name] — cost breakdown

Feature: [one-line description]
Workflow: design → plan → implement → review

---

## design

**Model:** [model]  |  **Engaged:** [time]  |  **Subagents:** [count]

[token table from cost_extract.py output]

**Cost estimate:** $X.XX

---

## plan

**Model:** [model]  |  **Engaged:** [time]  |  **Subagents:** [count]

[token table]

**Cost estimate:** $X.XX

**Plan quality notes:**
- Tasks: [N]
- Risks called out: [list or "none"]
- Self-review checklist: yes/no

---

## implement

**Model:** [model]  |  **Engaged:** [time]  |  **Subagents:** [count]

[token table + main/subs breakdown if applicable]

**Cost estimate:** $X.XX

**Execution quality notes:**
- Plan followed: yes / mostly / significantly deviated
- Rework turns (approx): [N]
- Integration issues caught proactively: [list or "none"]
- Coordination failures: [describe or "none"]

---

## review

**Model:** [model]  |  **Engaged:** [time]  |  **Subagents:** [count]

[token table]

**Cost estimate:** $X.XX

**Review findings:**
- [finding 1] — [real bug / style / false positive / housekeeping]
- [finding 2] — ...
- Code changes required: yes/no
- Verification commands run: yes/no
- Verdict: substantive / rubber-stamp

---

## Summary

| label | model | total tok | output | cache read | turns | engaged | cost $ |
|-------|-------|-----------|--------|------------|-------|---------|--------|
| design | ... | | | | | | |
| plan | ... | | | | | | |
| implement | ... | | | | | | |
| review | ... | | | | | | |
| **total** | | | | | | | |

### Notes
- [any notable findings, surprises, or deviations from expected patterns]
- Design:Implement cost ratio: [X.X:1]
```

## Step 5 — Add a calibration row

Append a row to `articles/cost-comparison-model-strategy.md` in a new section at the bottom called `## Calibration log` (create it if it doesn't exist). Format:

```
| [feature] | [design $] | [design model] | [plan $] | [plan model] | [impl $] | [impl model] | [review $] | [review model] | [total $] | [engaged] | [plan quality] | [review quality] | [impl turbulence] |
```

Where:
- plan quality: `high` / `medium` / `low` (based on implementation fidelity)
- review quality: `substantive` / `light` / `rubber-stamp`
- impl turbulence: `clean` / `minor rework` / `significant rework`

---PROMPT END---

---

## What to fill in before running

Replace the `[SESSION NAME]` placeholders with the `/rename` labels you used during those sessions. If you forgot to rename a session, you can search by approximate timestamp — the JSONL filename corresponds to the session UUID, and the first event has a `timestamp` field.

---

## Interpreting new data points

After running, compare your new feature against the existing table in `articles/cost-comparison-model-strategy.md`:

| What to check | What it tells you |
|---------------|-------------------|
| Plan/design cost ratio | Whether the Sonnet plan efficiency (~8–10%) holds, or whether this feature needed more planning |
| Implement/design ratio | Should stay near 0.5–1.1× depending on model; if it's higher, implementation was harder than design predicted |
| Review findings count | If review finds many real bugs, the implement quality is slipping — consider Opus for implement |
| Rework turns in implement | High rework (>15% of turns) suggests spec was ambiguous or model struggled with integration |
| Engaged time | Compare to prior features at similar design cost; should scale roughly linearly |

---

## Existing data points

| Feature | Design $ | Plan model | Plan $ | Impl model | Impl $ | Review $ | Total $ | Engaged | Plan quality | Review quality | Impl turbulence |
|---------|----------|-----------|--------|-----------|--------|----------|---------|---------|--------------|----------------|-----------------|
| acubemy-import | $103.54 | Opus 4.7 | $27.87 | Opus 4.7 | $115.49 | — | ~$247 | ~5h 16m | — (no data) | — | minor (wrong branch, self-caught) |
| storage-module | $30.51 | Opus 4.7 | $17.27 | Sonnet 4.6 | $25.49 | $3.62 | $76.89 | ~2h 28m | — (no data) | substantive | minor (review corrections) |
| resequence-panel | $19.27 | Sonnet 4.6 | $1.67 | Sonnet 4.6 | $10.43 | $3.53 | $34.90 | ~101m | high | substantive | minor (wrong branch ×2, self-caught) |

*Add new rows here as features ship.*
