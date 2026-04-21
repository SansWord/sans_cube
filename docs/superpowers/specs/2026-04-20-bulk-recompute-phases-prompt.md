# Kickoff prompt — Bulk Recompute Phases feature

Copy-paste the block below into a fresh Claude Code session when you're ready to build this feature.

---

I want to build a debug-mode feature to bulk-recompute phase breakdowns for all stored solves, because v1.24.0 and v1.24.1 changed the phase-detection predicates (`isCrossDone`, `isCMLLDone`, `isEODone`, etc.) to tolerate M/E/S center drift and whole-cube rotations. Existing `SolveRecord.phases[]` arrays in localStorage and Firestore were frozen under the old predicates and have stale phase-boundary timestamps for any solve that used slice moves — which is essentially every Roux solve's LSE.

Please read `docs/superpowers/specs/2026-04-20-bulk-recompute-phases-design.md` first — it has the full context, affected users, existing machinery to reuse, proposed UX, edge cases, and open questions.

Before writing any code:

1. Verify the design spec's assumptions still hold against current code (v1.24.1 + whatever has shipped since). In particular:
   - confirm `src/utils/recomputePhases.ts` still exports `recomputePhases(solve, method)` with the same signature
   - find the actual existing debug-mode scanner component (the spec says "mirror DetectMethodMismatchesModal" — verify the real filename)
   - confirm `useSolveHistory` still gates the localStorage-vs-Firestore decision so the bulk writer targets the right store
2. If any of those have changed, note what's different and adjust the plan before asking me to proceed.

Then use the `superpowers:brainstorming` skill to walk me through the small design decisions that aren't settled in the spec (modal detail level, whether to persist a `phasesRecomputedAt` timestamp, Firestore batch size), then `superpowers:writing-plans` to produce the implementation plan.

Scope guardrails:
- Debug-mode only, no auto-recompute on app load.
- Dry-run preview before committing.
- Loudly suggest running the backup-data debug action first (see `docs/data-backup.md`) since there's no undo.
- Skip `isExample` and `freeform` solves (same skips as `detectMethodMismatches`).
