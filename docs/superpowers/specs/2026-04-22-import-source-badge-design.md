# Import Source Badge — Design

**Status:** approved
**Date:** 2026-04-22

## Summary

Add a static, plain-text pill to the `SolveDetailModal` header that reads **"Imported from {source}"** when the solve has an `importedFrom` field. Pure provenance label — no actions, no links, no schema changes. Visible in the normal modal, in read-only mode, and in the shared-solve view.

## Motivation

The acubemy importer (shipped v1.21+) already tags imported solves with `importedFrom: { source: 'acubemy', externalId }`, but the UI surfaces this nowhere. From `docs/import-data.md`:

> The v1 UI does not badge imported solves visually — they look like native solves in the history list. A badge is planned (see `future.md`).

This spec ships the badge for the detail modal. Sidebar/list-view badging is out of scope.

## Design Decisions

1. **Provenance only, no action.** The pill is a static label — no link back to source, no re-import, no popover. Keeps scope minimal and avoids surfacing fields that may not exist (e.g., acubemy's per-solve URL pattern is not confirmed).
2. **Source name only.** Pill content is `Imported from {importedFrom.source}` — external ID is not shown (it's internal dedup metadata) and import date is not stored on the record.
3. **No new schema fields.** `SolveRecord.importedFrom` already has the right shape. No migration, no Firestore changes.
4. **Inline pill placement.** Sits next to the `Solve #N` title, matching the existing LinkedIn-pill pattern used for example solves (the placement convention is "small contextual labels live in the header row").
5. **Muted blue color palette.** Distinguishes the badge from existing header-area UI (orange = warnings, yellow/red = errors). Blue conveys neutral provenance info.
6. **Render literally.** The pill renders `Imported from {source}` with no whitelist — currently `source` is typed as the literal `'acubemy'`, so it always reads `Imported from acubemy`. If future schema widens the union, the badge tolerates it without code changes.
7. **No special-casing for example or migration banner.** Pill renders whenever `importedFrom` is set; the example solve's LinkedIn pill is on the opposite end of the header, and the migration warning banner sits below — no visual collision.

## Visual & Placement

**Position:** inside the `<div className="solve-detail-header">` row in `src/components/SolveDetailModal.tsx` (~line 296). Currently the header is a flex row: title-side (left) holds `Solve #N`; action-side (right) holds the LinkedIn pill (when example) and the close button. The new pill goes in the **title-side group**, immediately after the title `<span>`, separated by an `8px` gap.

**Markup change:** wrap the existing `<span>{title}</span>` in a flex container so the title and pill share a row baseline:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <span style={{ fontWeight: 'bold', fontSize: 16 }}>
    {localSolve.isExample ? 'Example Solve' : `Solve #${localSolve?.seq ?? localSolve.id}`}
  </span>
  {localSolve.importedFrom && (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      background: '#1a2a3a',
      border: '1px solid #2a4a6a',
      borderRadius: 10,
      color: '#6ab0e8',
      fontSize: 10,
      fontWeight: 'normal',
    }}>
      Imported from {localSolve.importedFrom.source}
    </span>
  )}
</div>
```

**Style summary:**

| Property | Value |
|---|---|
| `padding` | `2px 8px` |
| `background` | `#1a2a3a` (dark muted blue) |
| `border` | `1px solid #2a4a6a` |
| `borderRadius` | `10` |
| `color` | `#6ab0e8` (light muted blue) |
| `fontSize` | `10` |
| `fontWeight` | `normal` |

No icon, no link, no tooltip.

## Render Rule

```tsx
{localSolve.importedFrom && (
  <span style={/* … */}>
    Imported from {localSolve.importedFrom.source}
  </span>
)}
```

A single conditional. Consequences:

- **Native solves:** no `importedFrom` → pill not rendered.
- **Imported solves:** pill renders.
- **Read-only / shared-solve view:** unchanged — `useSharedSolve` hydrates `localSolve` with whatever's in the shared Firestore doc, including `importedFrom`. Pill renders the same way.
- **Example solve:** the built-in demo has no `importedFrom` → pill not rendered. LinkedIn pill on the right side unchanged. If a future example ever has `importedFrom`, both pills render in their respective ends of the header — no visual collision by design.
- **Migration warning banner:** unaffected. An imported v1-schema solve would show both: pill in the header, banner below the header. Distinct, non-overlapping information.

## Files Changed

| File | Change |
|---|---|
| `src/components/SolveDetailModal.tsx` | Wrap header title `<span>` in a flex container; add the conditional pill after the title span. |
| `tests/components/SolveDetailModal.test.tsx` | Add two render tests (with / without `importedFrom`). |
| `docs/import-data.md` | Replace the "no badge yet" caveat with present-tense note describing the pill. |
| `docs/ui-architecture.md` | Note the pill in `SolveDetailModal`'s feature description (no prop changes). |
| `docs/manual-test-checklist.md` | Add four QA scenarios (see Manual QA section). |
| `docs/devlog.md` | New `vX.Y.0` entry + TL;DR row at end of session. |

## Files NOT Changed (and why)

- `src/types/solve.ts` — `importedFrom` already has the right shape (`{ source: 'acubemy'; externalId: number | string }`). No new fields.
- `src/utils/acubemyImport/parseExport.ts` — already populates `importedFrom` at import time.
- Firestore / localStorage / migration code — no schema change; the field is already persisted by the importer and round-trips through both stores.
- `src/hooks/useSharedSolve.ts` — passes the full record through; `importedFrom` rides along automatically.
- `src/components/SolveHistorySidebar.tsx` — sidebar badging is out of scope (see "Out of Scope").
- `future.md` — the badge was only mentioned as a caveat inside `docs/import-data.md`, not as a top-level future item; nothing to cross off.

## Tests

### Unit tests (in `tests/components/SolveDetailModal.test.tsx`)

1. **Renders pill when `importedFrom` is present** — render with a solve that has `importedFrom: { source: 'acubemy', externalId: 42 }`; assert `screen.getByText(/Imported from acubemy/i)` is in the document.
2. **Does not render pill when `importedFrom` is absent** — render with a solve missing `importedFrom`; assert `screen.queryByText(/Imported from/i)` returns `null`.

No tests are written for the shared-solve view (visual-only behavior; the existing `useSharedSolve` tests already verify the field round-trips through `localSolve`) or for the example/migration combo cases (no logic to test — pure conditional rendering).

### Manual QA

Add to `docs/manual-test-checklist.md`:

- Open an imported solve → pill reads "Imported from acubemy" next to the title.
- Open a natively-recorded solve → no pill.
- Open the example solve → no Imported pill (LinkedIn pill on right unchanged).
- Open a shared imported solve via `#shared-XXX` → pill renders.

## Out of Scope

- **Sidebar / list-view badging.** Imported solves still look identical to native solves in `SolveHistorySidebar`. Future work if the user wants it.
- **Link back to acubemy.** No confirmed per-solve URL pattern; revisit only if the pattern is documented.
- **Persisting import-time warnings (e.g., `gyro-dropped`) on the record.** Currently those statuses live only in the import preview and disappear on commit. Surfacing them in the detail modal would require schema additions; treat as separate future work.
- **Import date field.** Would require a new `importedAt` field on `SolveRecord`. Not needed for a pure provenance label.
- **Multi-source support.** `importedFrom.source` is currently the literal `'acubemy'`. The pill renders `{source}` literally, so a future widening of the union (e.g., `'csTimer'`) is automatically supported, but no other code changes (importer, dedup) are in scope.

## Devlog Entry Sketch

When shipping, the devlog entry should include:

- **What was built:** "Imported from {source}" pill in `SolveDetailModal` header for solves with `importedFrom` set.
- **Key technical learnings:**
  - `[note]` Pill rendering reuses the LinkedIn-pill visual pattern (inline-flex, bordered, small font); no new schema fields needed since `importedFrom` was already populated by the acubemy importer at v1.21.
  - `[note]` `useSharedSolve` already round-trips `importedFrom` without modification — provenance travels with shared solves automatically.
