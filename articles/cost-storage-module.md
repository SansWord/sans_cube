# storage-module — cost breakdown

Produced by `scripts/cost_extract.py`. Tokens are the stable primary data; cost is derived from the rate card in the script.

**Rate card:** Anthropic April 2026 — Opus 4.x: $15/$75 in/out, cache_read $1.50, cw_1h $30 · Sonnet 4.x: $3/$15, cache_read $0.30, cw_5m $3.75, cw_1h $6

## Sessions

| Phase | Model | Total Tokens | Input | Output | Cache Read | CW 1h | CW 5m | Turns | Engaged | Subagents | Cost |
|-------|-------|-------------|-------|--------|------------|-------|-------|-------|---------|-----------|------|
| design | claude-opus-4-7 | 7.86M | 310 | 79.2K | 7.32M | 452.8K | 0 | 97 | 1h 2m | 0 | $30.51 |
| plan | claude-opus-4-7 | 4.11M | 72 | 72.3K | 3.84M | 202.9K | 0 | 45 | 9m 43s | 0 | $17.27 |
| implement | claude-sonnet-4-6 | 42.08M | 18.6K | 182.1K | 39.22M | 437.9K | 2.22M | 801 | 53m 22s | 32 | $25.49 |
| review | claude-sonnet-4-6 | 5.13M | 91 | 16.6K | 4.70M | 184.2K | 228.4K | 78 | 5m 35s | 1 | $3.62 |
| **Total** | | **59.18M** | | | | | | **1,021** | **2h 28m** | | **$76.89** |

### Implement — main loop vs subagents

| | Model | Files | Turns | Total Tokens | Output | CW 5m | CW 1h | Cost |
|---|-------|-------|-------|-------------|--------|-------|-------|------|
| main | claude-sonnet-4-6 | 1 | 213 | 22.61M | 85.1K | 0 | 437.9K | $10.53 |
| subs | claude-sonnet-4-6 | 32 | 588 | 19.47M | 97.1K | 2.22M | 0 | $14.96 |

### Review — main loop vs subagents

| | Model | Files | Turns | Total Tokens | Output | CW 5m | CW 1h | Cost |
|---|-------|-------|-------|-------------|--------|-------|-------|------|
| main | claude-sonnet-4-6 | 1 | 19 | 921.4K | 6.8K | 0 | 184.2K | $1.43 |
| subs | claude-sonnet-4-6 | 1 | 59 | 4.21M | 9.7K | 228.4K | 0 | $2.19 |

## Ratios

| | Value |
|-|-------|
| Implement+Review / Design cost | $29.11 / $30.51 = **0.954** |
| Plan / Design cost | $17.27 / $30.51 = **0.566** |
| Implement+Review / Design output tokens | 198.7K / 79.2K = **2.508** |
