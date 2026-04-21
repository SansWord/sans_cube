# Session Cost Analysis

> **Temporary doc.** Once `scripts/cost_extract.py` is extended into a Claude skill, this file should be removed — `docs/` is for sans_cube app documentation, not tooling.

## Script

`scripts/cost_extract.py` — extracts token usage and cost from a Claude Code session JSONL.

```bash
python3 scripts/cost_extract.py \
  --project-dir ~/.claude/projects/-Users-sansword-Source-github-sans-cube \
  --label <phase> \
  "<session name>"
```

- First argument: session name (from `/rename`) or path to `.jsonl`
- Subagents auto-discovered from `<session-uuid>/subagents/*.jsonl`
- `--no-subagents` to exclude them
- `--json` for raw JSON output

## Rate card (Anthropic April 2026)

| Model | Input | Output | Cache read | Cache write 1h |
|-------|-------|--------|------------|----------------|
| Opus 4.x | $15/MTok | $75/MTok | $1.50/MTok | $30/MTok |
| Sonnet 4.x | $3/MTok | $15/MTok | $0.30/MTok | $6/MTok |
| Haiku 4.5 | $1/MTok | $5/MTok | $0.10/MTok | $2/MTok |

Token counts are stable. Re-run the script if Anthropic changes prices.

## Cost files

Each feature's cost breakdown lives in `articles/cost-<feature-name>.md`. Cross-feature comparison in `articles/cost-comparison-acubemy-vs-storage-module.md`.
