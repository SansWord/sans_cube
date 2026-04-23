# Import Source Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a static "Imported from {source}" pill in the `SolveDetailModal` header for solves that carry an `importedFrom` field.

**Architecture:** One conditional `<span>` added to `SolveDetailModal`'s existing header row, gated on `localSolve.importedFrom`. No schema, hook, service, or storage changes — the field is already populated by the acubemy importer (v1.21+) and round-trips through localStorage, Firestore, and `useSharedSolve`. Docs catch up in step with the UI change.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library for component tests. The modal uses Three.js via `CubeCanvas`, so tests must mock that component (no WebGL in jsdom).

**Spec reference:** [`docs/superpowers/specs/2026-04-22-import-source-badge-design.md`](../specs/2026-04-22-import-source-badge-design.md)

**Target version:** v1.28.0 (devlog + tag happen at "ship it" time, not inside this plan).

---

## File Structure

| File | Role |
|---|---|
| `src/components/SolveDetailModal.tsx` | Add the pill inside the header row; wrap the title `<span>` in a flex container. Single-file UI change. |
| `tests/components/SolveDetailModal.test.tsx` | **New file.** Two render tests — with / without `importedFrom`. Mocks `CubeCanvas` to avoid Three.js in jsdom. |
| `docs/import-data.md` | Replace the "badge planned" caveat with a present-tense description of the pill. |
| `docs/ui-architecture.md` | Append a sentence to `SolveDetailModal`'s feature description noting the pill. |
| `docs/manual-test-checklist.md` | Add a new subsection `4e. Import badge` with four QA items. |

Files **not** touched (and why): `src/types/solve.ts` (shape already correct), `src/utils/acubemyImport/parseExport.ts` (already writes the field), `src/hooks/useSharedSolve.ts` (transparent passthrough), `src/components/SolveHistorySidebar.tsx` (sidebar badging is out of scope), `future.md` (the badge was a caveat inside `docs/import-data.md`, not a tracked future item).

---

## Task 1: Create feature branch

**Files:** none (git state only)

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` on `main`.

If dirty, stop and surface the uncommitted state — do not proceed.

- [ ] **Step 2: Create and switch to the feature branch**

Run: `git checkout -b import-source-badge`
Expected: `Switched to a new branch 'import-source-badge'`.

---

## Task 2: Add failing tests for the pill

**Files:**
- Create: `tests/components/SolveDetailModal.test.tsx`

The modal instantiates `CubeRenderer` (Three.js) through `CubeCanvas`, which requires WebGL and blows up in jsdom. Mock `CubeCanvas` to a plain `<div>` so the header can render. Everything else (phases, hooks, `useReplayController`) is fine in jsdom because the mocked canvas short-circuits the renderer-dependent effects.

- [ ] **Step 1: Write the test file**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SolveDetailModal } from '../../src/components/SolveDetailModal'
import type { SolveRecord } from '../../src/types/solve'

// Three.js needs WebGL, which jsdom does not provide. Swap CubeCanvas for a stub.
vi.mock('../../src/components/CubeCanvas', () => ({
  CubeCanvas: () => <div data-testid="cube-canvas-stub" />,
}))

function makeSolve(overrides: Partial<SolveRecord> = {}): SolveRecord {
  return {
    id: 1,
    seq: 1,
    scramble: 'R U R\' U\'',
    timeMs: 12340,
    moves: [],
    phases: [],
    date: Date.now(),
    method: 'cfop',
    ...overrides,
  }
}

const baseProps = {
  onClose: vi.fn(),
  onDelete: vi.fn(),
  onUpdate: vi.fn().mockResolvedValue(undefined),
}

describe('SolveDetailModal — import source badge', () => {
  it('renders "Imported from {source}" pill when importedFrom is present', () => {
    const solve = makeSolve({
      importedFrom: { source: 'acubemy', externalId: 42 },
    })
    render(<SolveDetailModal solve={solve} {...baseProps} />)
    expect(screen.getByText(/Imported from acubemy/i)).toBeInTheDocument()
  })

  it('does not render the pill when importedFrom is absent', () => {
    const solve = makeSolve()
    render(<SolveDetailModal solve={solve} {...baseProps} />)
    expect(screen.queryByText(/Imported from/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npx vitest run tests/components/SolveDetailModal.test.tsx`
Expected: the first test FAILS with a message like `Unable to find an element with the text /Imported from acubemy/i`. The second test PASSES (the pill isn't rendered yet, and we're asserting its absence — this is fine; the failing test is enough to drive implementation).

If the first test errors out before reaching the assertion (e.g., Three.js import error), fix the `CubeCanvas` mock path first. The goal is an assertion failure, not a module-load failure.

---

## Task 3: Implement the pill

**Files:**
- Modify: `src/components/SolveDetailModal.tsx` (header row, ~line 296-297)

- [ ] **Step 1: Replace the header title span with a flex container + conditional pill**

Find this line (around line 297):

```tsx
<span style={{ fontWeight: 'bold', fontSize: 16 }}>{localSolve.isExample ? 'Example Solve' : `Solve #${localSolve?.seq ?? localSolve.id}`}</span>
```

Replace it with:

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

Do not change any other part of the header. The outer `<div className="solve-detail-header">` (still a `space-between` flex row) keeps the title group on the left and the `LinkedIn pill + close button` group on the right.

- [ ] **Step 2: Run the new tests and verify they pass**

Run: `npx vitest run tests/components/SolveDetailModal.test.tsx`
Expected: both tests PASS.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass. No existing test references the header title structure, so nothing should regress — but confirm.

- [ ] **Step 4: Typecheck + lint + build**

Run: `npm run build && npm run lint`
Expected: clean build and no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SolveDetailModal.tsx tests/components/SolveDetailModal.test.tsx
git commit -m "feat: show import source pill in SolveDetailModal header"
```

---

## Task 4: Update docs

No tests drive these — they are reference docs. Edit, then eyeball the result.

**Files:**
- Modify: `docs/import-data.md` (line 35)
- Modify: `docs/ui-architecture.md` (around line 101, `SolveDetailModal` description)
- Modify: `docs/manual-test-checklist.md` (section 4, after `4d. URL deep link`)

- [ ] **Step 1: Update `docs/import-data.md`**

Find this bullet (line 35):

```
- The v1 UI does not badge imported solves visually — they look like native solves in the history list. A badge is planned (see `future.md`).
```

Replace with:

```
- Imported solves show an **"Imported from {source}"** pill next to the title in the detail modal (including the shared-solve read-only view). The history sidebar does not badge them — they still look like native solves in the list.
```

- [ ] **Step 2: Update `docs/ui-architecture.md`**

Find the paragraph about `SolveDetailModal` that currently ends (around line 101):

```
Props: `onUpdate`, `onDelete`, `onShare?`, `onUnshare?`, `readOnly?` — `onShare`/`onUnshare` are only passed when cloud sync is enabled and the user is signed in. When `readOnly` is true (viewer mode), all action controls (delete, share, copy-as-example) are hidden.
```

Append a new sentence to the end of that paragraph:

```
When the solve has `importedFrom` set, a small "Imported from {source}" pill renders next to the title in the header (provenance label only — no action).
```

- [ ] **Step 3: Update `docs/manual-test-checklist.md`**

Find the `### 4d. URL deep link` block and append a new subsection `### 4e. Import badge` immediately after it (before the `---` separator that ends section 4):

```
### 4e. Import badge

- [ ] Open an imported solve (one with `importedFrom` set, e.g. an acubemy-imported solve) → pill reads "Imported from acubemy" next to the `Solve #N` title
- [ ] Open a natively-recorded solve → no Imported pill
- [ ] Open the example solve → no Imported pill (LinkedIn "Built by SansWord" pill on the right side is unchanged)
- [ ] Open a shared imported solve via `#shared-{shareId}` → pill still renders in read-only mode
```

- [ ] **Step 4: Commit**

```bash
git add docs/import-data.md docs/ui-architecture.md docs/manual-test-checklist.md
git commit -m "docs: describe import source pill in modal + manual QA"
```

---

## Out of scope (do not do in this plan)

- **Devlog entry + TL;DR row + git tag + merge to main** — these happen at the "ship it" step the user triggers after review, not inside the plan. The spec's devlog sketch will be the starting point then.
- **Sidebar / list-view badging** — explicitly out of scope per spec.
- **Any schema changes** — `SolveRecord.importedFrom` is already in place.
- **Visual polish beyond the spec's style table** — no icon, link, tooltip, or hover behavior.

---

## Self-review

**Spec coverage check:**
- Pill placement in header — Task 3 Step 1 ✓
- Style values (padding, colors, radius, font) — Task 3 Step 1 matches the spec's style table ✓
- Conditional render rule (`importedFrom` gates pill) — Task 3 Step 1 ✓
- Two unit tests (with / without) — Task 2 ✓
- `docs/import-data.md` caveat replaced — Task 4 Step 1 ✓
- `docs/ui-architecture.md` note — Task 4 Step 2 ✓
- `docs/manual-test-checklist.md` four QA items — Task 4 Step 3 ✓
- No schema change, no hook change, no importer change — nothing in the task list touches those ✓
- Devlog entry — deferred to "ship it" (noted in Out of Scope) ✓

**Placeholder scan:** no `TBD`, no "add appropriate error handling", no "similar to Task N" — all code is inline and complete.

**Type consistency:** the test uses `SolveRecord` with `importedFrom: { source: 'acubemy', externalId: 42 }` — matches the existing type in `src/types/solve.ts:39-42`. The pill renders `localSolve.importedFrom.source`, which the TypeScript narrowing in the `&&` guard keeps type-safe.
