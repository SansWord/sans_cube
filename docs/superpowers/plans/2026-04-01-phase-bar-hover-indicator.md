# Phase Bar Hover Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a vertical indicator line on the `PhaseBar` that tracks the cursor (desktop) or touch position (mobile) while the user is interacting with it.

**Architecture:** All changes are self-contained in `src/components/PhaseBar.tsx`. A new `hoverPct: number | null` state drives a second indicator line rendered in the same absolute-positioned layer as the existing replay playhead. Mouse and touch event handlers on the outer bar container compute position using `getBoundingClientRect`.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react, jsdom

---

### Task 1: Write failing tests for hover indicator

**Files:**
- Create: `tests/components/PhaseBar.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PhaseBar } from '../../src/components/PhaseBar'
import { CFOP } from '../../src/methods/cfop'
import type { PhaseRecord } from '../../src/types/solve'

const phases: PhaseRecord[] = [
  { label: 'Cross', recognitionMs: 0, executionMs: 2000, turns: 5 },
  { label: 'F2L Slot 1', group: 'F2L', recognitionMs: 500, executionMs: 1500, turns: 8 },
]

function mockRect(el: HTMLElement) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0, width: 400, top: 0, right: 400, bottom: 24, height: 24, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

describe('PhaseBar hover indicator', () => {
  it('shows indicator on mousemove and hides on mouseleave', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()

    fireEvent.mouseMove(bar, { clientX: 200 })
    const indicator = screen.getByTestId('hover-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator.style.left).toBe('50%')

    fireEvent.mouseLeave(bar)
    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()
  })

  it('shows indicator on touchmove and hides on touchend', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()

    fireEvent.touchMove(bar, { touches: [{ clientX: 100 }] })
    const indicator = screen.getByTestId('hover-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator.style.left).toBe('25%')

    fireEvent.touchEnd(bar)
    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()
  })

  it('does not show indicator when interactive is false', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} interactive={false} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    fireEvent.mouseMove(bar, { clientX: 200 })
    expect(screen.queryByTestId('hover-indicator')).not.toBeInTheDocument()
  })

  it('clamps indicator to 0% at left edge', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    fireEvent.mouseMove(bar, { clientX: -50 })
    expect(screen.getByTestId('hover-indicator').style.left).toBe('0%')
  })

  it('clamps indicator to 100% at right edge', () => {
    render(<PhaseBar phaseRecords={phases} method={CFOP} />)
    const bar = screen.getByTestId('phase-bar-track')
    mockRect(bar)

    fireEvent.mouseMove(bar, { clientX: 500 })
    expect(screen.getByTestId('hover-indicator').style.left).toBe('100%')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/components/PhaseBar.test.tsx
```

Expected: All 5 tests FAIL — `phase-bar-track` testid not found, `hover-indicator` not found.

---

### Task 2: Implement hover indicator in PhaseBar

**Files:**
- Modify: `src/components/PhaseBar.tsx`

- [ ] **Step 1: Add `hoverPct` state and `calcPct` helper**

At the top of the `PhaseBar` function (after the existing `hoveredIndex` and `mousePos` state), add:

```tsx
const [hoverPct, setHoverPct] = useState<number | null>(null)
```

After the `fmtTps` function (before the `PhaseBar` function), add:

```ts
function calcPct(clientX: number, el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
}
```

- [ ] **Step 2: Add `data-testid` and event handlers to the outer container**

The outer container is the first `<div>` returned (the one with `position: 'relative', width: '100%', maxWidth: 720`). Change it to:

```tsx
<div
  data-testid="phase-bar-track"
  style={{ position: 'relative', width: '100%', maxWidth: 720, margin: '8px auto 0' }}
  onMouseMove={(e) => interactive && setHoverPct(calcPct(e.clientX, e.currentTarget))}
  onMouseLeave={() => { interactive && setHoverPct(null) }}
  onTouchMove={(e) => interactive && setHoverPct(calcPct(e.touches[0].clientX, e.currentTarget))}
  onTouchEnd={() => { interactive && setHoverPct(null) }}
>
```

- [ ] **Step 3: Render the hover indicator line**

In the same block that renders the existing `indicatorPct` playhead (around line 69), add the hover indicator right after it:

```tsx
{/* Hover indicator */}
{hoverPct !== null && (
  <div
    data-testid="hover-indicator"
    style={{
      position: 'absolute',
      top: 0,
      left: `${hoverPct}%`,
      width: 2,
      height: 24,
      background: '#fff',
      borderRadius: 1,
      pointerEvents: 'none',
      boxShadow: '0 0 4px rgba(0,0,0,0.6)',
      transform: 'translateX(-1px)',
    }}
  />
)}
```

- [ ] **Step 4: Run tests to confirm they all pass**

```bash
npx vitest run tests/components/PhaseBar.test.tsx
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PhaseBar.tsx tests/components/PhaseBar.test.tsx
git commit -m "feat: add hover/touch position indicator to PhaseBar"
```
