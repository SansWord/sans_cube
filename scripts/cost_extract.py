#!/usr/bin/env python3
"""
cost_extract.py — extract token usage and cost for a single Claude Code session.

Usage:
  python3 scripts/cost_extract.py <session-name-or-path> [subagent.jsonl ...]
    [--label LABEL] [--project-dir PATH] [--json]

  <session-name-or-path>
      Either a path to a .jsonl file, or the session name you gave via /rename.
      Name lookup searches ~/.claude/projects/<project-id>/ using the last
      custom-title event in each file (handles sessions renamed mid-way).

  Subagents are discovered automatically from <session-uuid>/subagents/*.jsonl
  next to the main file. Pass --no-subagents to exclude them.

  --label LABEL
      Short label for this session in output (e.g. "design", "implement").
      Defaults to the session name argument.

  --project-dir PATH
      Override the Claude project directory. Auto-detected from the nearest
      .git root if omitted.

  --no-subagents
      Skip subagent files even if they exist.

  --json
      Also emit a raw JSON block of all numbers (for scripting).

Output:
  Token breakdown table (stable — survives rate card changes) and a cost
  estimate section (derived from the hardcoded rate card).

Rate card (Anthropic, April 2026):
  Opus 4:    input $15,  output $75,  cache_read $1.50, cw_5m $18.75, cw_1h $30
  Sonnet 4:  input $3,   output $15,  cache_read $0.30, cw_5m $3.75,  cw_1h $6
  Haiku 4.5: input $1,   output $5,   cache_read $0.10, cw_5m $1.25,  cw_1h $2

Key parsing notes:
  - cache_creation.ephemeral_Xh_input_tokens is the authoritative tier breakdown.
  - cache_creation_input_tokens (plain int) is the sum — ignored to avoid double-counting.
  - cw_1h = 2× input rate (both Opus and Sonnet sessions use the 1h tier).
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Rate card — per MTok, longest-prefix match wins
# ---------------------------------------------------------------------------
RATES = [
    ("claude-opus-4-7",   dict(inp=15.00, out=75.00, cr=1.50, cw5=18.75, cw1h=30.00)),
    ("claude-opus-4",     dict(inp=15.00, out=75.00, cr=1.50, cw5=18.75, cw1h=30.00)),
    ("claude-sonnet-4-6", dict(inp=3.00,  out=15.00, cr=0.30, cw5=3.75,  cw1h=6.00)),
    ("claude-sonnet-4",   dict(inp=3.00,  out=15.00, cr=0.30, cw5=3.75,  cw1h=6.00)),
    ("claude-sonnet-3-7", dict(inp=3.00,  out=15.00, cr=0.30, cw5=3.75,  cw1h=6.00)),
    ("claude-sonnet-3-5", dict(inp=3.00,  out=15.00, cr=0.30, cw5=3.75,  cw1h=6.00)),
    ("claude-haiku-4-5",  dict(inp=1.00,  out=5.00,  cr=0.10, cw5=1.25,  cw1h=2.00)),
    ("claude-haiku-4",    dict(inp=0.80,  out=4.00,  cr=0.08, cw5=1.00,  cw1h=2.00)),
]

def get_rates(model_id):
    if not model_id:
        return None
    for prefix, r in RATES:
        if model_id.startswith(prefix):
            return r
    return None

# ---------------------------------------------------------------------------
# Session name → JSONL path
# ---------------------------------------------------------------------------

def find_project_dir(start=None):
    path = Path(start or os.getcwd()).resolve()
    for p in [path] + list(path.parents):
        if (p / ".git").exists():
            key = str(p).replace("/", "-").replace("\\", "-").lstrip("-")
            claude_dir = Path.home() / ".claude" / "projects" / f"-{key}"
            if claude_dir.exists():
                return claude_dir
    return None

def resolve_session(arg, project_dir):
    if os.path.exists(arg):
        return arg
    if project_dir is None:
        print(f"ERROR: '{arg}' is not a file and no project dir found for name lookup.", file=sys.stderr)
        sys.exit(1)
    target = arg.lower()
    for jsonl in Path(project_dir).glob("*.jsonl"):
        try:
            last_title = None
            with open(jsonl) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        ev = json.loads(line)
                    except Exception:
                        continue
                    if ev.get("type") == "custom-title":
                        last_title = ev.get("customTitle", "")
            if last_title and last_title.lower() == target:
                return str(jsonl)
        except Exception:
            continue
    print(f"ERROR: no session named '{arg}' in {project_dir}", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_jsonl(path):
    events = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return events

def extract_tokens(events):
    """
    Returns (tokens_by_model, timestamps, unknown_models).

    Reads cache write tiers from cache_creation.ephemeral_Xh_input_tokens only.
    cache_creation_input_tokens (plain int) is the total — skipped to avoid
    double-counting. Deduplicates events by UUID.
    """
    tokens_by_model = defaultdict(lambda: dict(inp=0, out=0, cr=0, cw5=0, cw1h=0, turns=0))
    timestamps = []
    unknown_models = set()
    seen_uuids = set()

    for ev in events:
        ts_str = ev.get("timestamp")
        if ts_str:
            try:
                timestamps.append(datetime.fromisoformat(ts_str.replace("Z", "+00:00")))
            except Exception:
                pass

        uid = ev.get("uuid")
        msg = ev.get("message", {})
        model = (msg.get("model") if isinstance(msg, dict) else None) or ev.get("model")
        usage = (msg.get("usage") if isinstance(msg, dict) else None) or ev.get("usage")

        if not (usage and isinstance(usage, dict)):
            continue

        inp = usage.get("input_tokens", 0)
        out = usage.get("output_tokens", 0)
        if inp == 0 and out == 0:
            continue

        if uid and uid in seen_uuids:
            continue
        if uid:
            seen_uuids.add(uid)

        if model and get_rates(model) is None:
            unknown_models.add(model)

        key = model or "unknown"
        t = tokens_by_model[key]
        t["inp"]   += inp
        t["out"]   += out
        t["cr"]    += usage.get("cache_read_input_tokens", 0)
        t["turns"] += 1

        cc = usage.get("cache_creation", {}) or {}
        if isinstance(cc, dict):
            t["cw5"]  += cc.get("ephemeral_5m_input_tokens", 0)
            t["cw1h"] += cc.get("ephemeral_1h_input_tokens", 0)

    return dict(tokens_by_model), timestamps, unknown_models

def engaged_seconds(timestamps, gap=600):
    if len(timestamps) < 2:
        return 0
    ts = sorted(timestamps)
    return sum(
        (ts[i] - ts[i-1]).total_seconds()
        for i in range(1, len(ts))
        if (ts[i] - ts[i-1]).total_seconds() <= gap
    )

def compute_cost(tokens_by_model):
    total = 0.0
    for model, t in tokens_by_model.items():
        r = get_rates(model)
        if r is None:
            continue
        total += (
            t["inp"]  * r["inp"]  / 1e6 +
            t["out"]  * r["out"]  / 1e6 +
            t["cr"]   * r["cr"]   / 1e6 +
            t["cw5"]  * r["cw5"]  / 1e6 +
            t["cw1h"] * r["cw1h"] / 1e6
        )
    return total

def primary_model(tokens_by_model):
    if not tokens_by_model:
        return "unknown"
    return max(tokens_by_model, key=lambda m: tokens_by_model[m]["out"])

# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def fmt_time(seconds):
    m, s = int(seconds // 60), int(seconds % 60)
    return f"{m // 60}h {m % 60}m" if m >= 60 else f"{m}m {s}s"

def fmt_tok(n):
    if n >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def find_subagents(main_jsonl_path):
    """Return all subagent JSONLs in <session-uuid>/subagents/ next to the main file."""
    main = Path(main_jsonl_path)
    sub_dir = main.parent / main.stem / "subagents"
    if not sub_dir.is_dir():
        return []
    return sorted(sub_dir.glob("*.jsonl"))

def build_parser():
    p = argparse.ArgumentParser(
        description="Extract token usage and cost for a single Claude Code session.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("session", help="Session name (from /rename) or path to .jsonl file")
    p.add_argument("--label", default=None,
                   help="Short label for output (defaults to session name)")
    p.add_argument("--project-dir", default=None,
                   help="~/.claude/projects/<id>/ (auto-detected from .git if omitted)")
    p.add_argument("--no-subagents", action="store_true",
                   help="Exclude subagent files even if they exist")
    p.add_argument("--json", action="store_true", help="Also emit raw JSON block")
    return p

def main():
    args = build_parser().parse_args()

    project_dir = args.project_dir or find_project_dir()
    main_jsonl  = resolve_session(args.session, project_dir)
    sub_jsonls  = [] if args.no_subagents else find_subagents(main_jsonl)

    label = args.label or args.session

    # Aggregate tokens across main + subagents
    all_tokens = defaultdict(lambda: dict(inp=0, out=0, cr=0, cw5=0, cw1h=0, turns=0))
    all_timestamps = []
    all_unknowns = set()

    for path in [main_jsonl] + sub_jsonls:
        events = parse_jsonl(path)
        tbm, ts, unk = extract_tokens(events)
        all_timestamps.extend(ts)
        all_unknowns |= unk
        for model, t in tbm.items():
            for k in ("inp", "out", "cr", "cw5", "cw1h", "turns"):
                all_tokens[model][k] += t[k]

    all_tokens = dict(all_tokens)
    model   = primary_model(all_tokens)
    cost    = compute_cost(all_tokens)
    engaged = engaged_seconds(all_timestamps)

    def agg(field):
        return sum(t[field] for t in all_tokens.values())

    total_tok = agg("inp") + agg("out") + agg("cr") + agg("cw5") + agg("cw1h")
    turns     = agg("turns")
    flag      = " ⚠️" if all_unknowns else ""

    # ---- Token breakdown ----
    print(f"\n### {label}\n")
    print(f"**Model:** {model}{flag}  |  **Engaged:** {fmt_time(engaged)}  |  **Subagents:** {len(sub_jsonls)}\n")
    print("| Token type  | Count |")
    print("|-------------|-------|")
    print(f"| Input       | {fmt_tok(agg('inp'))} |")
    print(f"| Output      | {fmt_tok(agg('out'))} |")
    print(f"| Cache read  | {fmt_tok(agg('cr'))} |")
    print(f"| Cache write 5m  | {fmt_tok(agg('cw5'))} |")
    print(f"| Cache write 1h  | {fmt_tok(agg('cw1h'))} |")
    print(f"| **Total**   | **{fmt_tok(total_tok)}** |")
    print(f"| Turns       | {turns} |")
    print()

    # ---- Cost estimate ----
    print(f"**Cost estimate:** ${cost:.2f}  *(rate card: scripts/cost_extract.py, Anthropic April 2026)*")
    if all_unknowns:
        print(f"⚠️ Unknown model(s) excluded from cost: {', '.join(all_unknowns)}")
    print()

    # ---- Single-row summary (for building tracking tables) ----
    print("**Summary row:**")
    print("| label | model | total tok | input | output | cache read | cw 1h | turns | engaged | cost $ |")
    print("|-------|-------|-----------|-------|--------|------------|-------|-------|---------|--------|")
    print(f"| {label} | {model} | {fmt_tok(total_tok)}"
          f" | {fmt_tok(agg('inp'))} | {fmt_tok(agg('out'))}"
          f" | {fmt_tok(agg('cr'))} | {fmt_tok(agg('cw1h'))}"
          f" | {turns} | {fmt_time(engaged)} | ${cost:.2f} |")
    print()

    if args.json:
        import json as _json
        out = dict(
            label=label,
            session=args.session,
            model=model,
            subagent_count=len(sub_jsonls),
            engaged_seconds=engaged,
            cost_usd=round(cost, 4),
            unknown_models=list(all_unknowns),
            tokens=dict(
                inp=agg("inp"), out=agg("out"), cr=agg("cr"),
                cw5=agg("cw5"), cw1h=agg("cw1h"), total=total_tok, turns=turns,
            ),
        )
        print("```json")
        print(_json.dumps(out, indent=2))
        print("```")

if __name__ == "__main__":
    main()
