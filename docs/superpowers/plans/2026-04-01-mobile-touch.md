# Mobile & Touch Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable on smartphones with a fullscreen timer layout and touch-driven 3D cube interaction.

**Architecture:** CSS media query at ≤768px hides the sidebar and makes the center column full-width; a "Solves" button in `TimerScreen` (CSS-hidden on desktop via `.solves-btn-mobile`) opens the sidebar content as a `position: fixed` overlay. Touch events on `CubeCanvas` mirror the existing mouse logic exactly, feeding into the same `determineMoveFromDrag` pipeline.

**Tech Stack:** React 19, TypeScript, Three.js, CSS media queries, Vitest + @testing-library/react

---

## File Map

| File | Change |
|------|--------|
| `src/index.css` | Add `.solves-btn-mobile` hide rule + `@media (max-width: 768px)` block |
| `src/components/SolveHistorySidebar.tsx` | Add optional `onClose?: () => void` prop + overlay render path; add `className="sidebar-wrapper"` to outer div |
| `src/components/TimerScreen.tsx` | Add `showHistory` state; add `.timer-center` class to center column; add Solves button + overlay |
| `src/components/CubeCanvas.tsx` | Add `lastTouchPos` ref + 3 touch handlers; replace inline `height` with `.cube-canvas` class; add `touchAction: none` |
| `tests/components/SolveHistorySidebar.test.tsx` | New: close button renders + calls onClose |

---

## Task 1: CSS mobile classes and breakpoint

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add CSS rules**

Append to `src/index.css`:

```css
.solves-btn-mobile { display: none; }
.cube-canvas { height: 480px; }

@media (max-width: 768px) {
  .sidebar-wrapper { display: none !important; }
  .timer-center {
    width: 100% !important;
    transform: none !important;
  }
  .solves-btn-mobile { display: block !important; }
  .cube-canvas { height: 300px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "style: add mobile breakpoint classes"
```

---

## Task 2: SolveHistorySidebar — overlay mode

**Files:**
- Modify: `src/components/SolveHistorySidebar.tsx`
- Test: `tests/components/SolveHistorySidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/SolveHistorySidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SolveHistorySidebar } from '../../src/components/SolveHistorySidebar'

const baseProps = {
  solves: [],
  stats: {
    single: { current: null, best: null },
    ao5: { current: null, best: null },
    ao12: { current: null, best: null },
    ao100: { current: null, best: null },
  },
  onSelectSolve: vi.fn(),
  width: 160,
  onWidthChange: vi.fn(),
}

describe('SolveHistorySidebar', () => {
  it('does not render a close button in sidebar mode', () => {
    render(<SolveHistorySidebar {...baseProps} />)
    expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument()
  })

  it('renders a close button when onClose is provided', () => {
    render(<SolveHistorySidebar {...baseProps} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<SolveHistorySidebar {...baseProps} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/components/SolveHistorySidebar.test.tsx
```

Expected: FAIL — `onClose` prop does not exist yet.

- [ ] **Step 3: Add `onClose` prop and overlay render path**

Replace `src/components/SolveHistorySidebar.tsx` entirely with:

```tsx
import { useCallback, useRef } from 'react'
import type { SolveRecord } from '../types/solve'

interface StatEntry {
  current: number | null
  best: number | null
}

interface SolveStats {
  single: StatEntry
  ao5: StatEntry
  ao12: StatEntry
  ao100: StatEntry
}

interface Props {
  solves: SolveRecord[]
  stats: SolveStats
  onSelectSolve: (solve: SolveRecord) => void
  width: number
  onWidthChange: (w: number) => void
  onClose?: () => void
}

const MIN_WIDTH = 120
const MAX_WIDTH = 320
const DEFAULT_WIDTH = 160

function calcFontSize(width: number): number {
  const t = (width - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)
  return Math.round(11 + t * 5)
}

function fmtTime(ms: number | null): string {
  if (ms === null) return '—'
  return (ms / 1000).toFixed(2)
}

function fmtTps(solve: SolveRecord): string {
  const secs = solve.timeMs / 1000
  if (secs === 0) return '—'
  return (solve.moves.length / secs).toFixed(2)
}

export function SolveHistorySidebar({ solves, stats, onSelectSolve, width, onWidthChange, onClose }: Props) {
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_WIDTH)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    e.preventDefault()

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - startX.current
      onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)))
    }
    const onMouseUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [width, onWidthChange])

  const rows: Array<{ label: string; entry: StatEntry }> = [
    { label: 'Single', entry: stats.single },
    { label: 'Ao5', entry: stats.ao5 },
    { label: 'Ao12', entry: stats.ao12 },
    { label: 'Ao100', entry: stats.ao100 },
  ]
  const reversedSolves = [...solves].reverse()

  // Overlay mode (mobile): full-screen fixed panel
  if (onClose) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0a0a1a', display: 'flex', flexDirection: 'column', fontSize: 13, color: '#ccc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #222', flexShrink: 0 }}>
          <span style={{ fontWeight: 'bold', color: '#888' }}>Solves</span>
          <button onClick={onClose} style={{ background: 'transparent', color: '#e94560', fontSize: 18, padding: '0 4px', border: 'none' }}>✕</button>
        </div>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #222', flexShrink: 0 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#888' }}>Statistics</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#555', fontSize: 11 }}>
                <td></td>
                <td style={{ textAlign: 'right' }}>Current</td>
                <td style={{ textAlign: 'right' }}>Best</td>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, entry }) => (
                <tr key={label}>
                  <td style={{ color: '#888' }}>{label}</td>
                  <td style={{ textAlign: 'right' }}>{fmtTime(entry.current)}</td>
                  <td style={{ textAlign: 'right', color: '#2ecc71' }}>{fmtTime(entry.best)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          <div style={{ color: '#555', fontSize: 11, padding: '0 12px 4px' }}>Last Solves</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#555', fontSize: 11 }}>
                <td style={{ padding: '2px 12px' }}>#</td>
                <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
                <td style={{ textAlign: 'right', padding: '2px 12px' }}>TPS</td>
              </tr>
            </thead>
            <tbody>
              {reversedSolves.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectSolve(s)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#111')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '3px 12px', color: '#555' }}>{s.isExample ? '★' : s.id}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{fmtTime(s.timeMs)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 12px', color: '#888' }}>{fmtTps(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Sidebar mode (desktop): existing layout
  const fontSize = calcFontSize(width)

  return (
    <div className="sidebar-wrapper" style={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
      <div style={{
        width,
        background: '#0a0a1a',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        fontSize,
        color: '#ccc',
      }}>
        <div style={{ padding: '10px 8px', borderBottom: '1px solid #222' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#888' }}>Statistics</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#555', fontSize: fontSize - 2 }}>
                <td></td>
                <td style={{ textAlign: 'right' }}>Current</td>
                <td style={{ textAlign: 'right' }}>Best</td>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, entry }) => (
                <tr key={label}>
                  <td style={{ color: '#888' }}>{label}</td>
                  <td style={{ textAlign: 'right' }}>{fmtTime(entry.current)}</td>
                  <td style={{ textAlign: 'right', color: '#2ecc71' }}>{fmtTime(entry.best)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          <div style={{ color: '#555', fontSize: fontSize - 2, padding: '0 8px 4px' }}>Last Solves</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#555', fontSize: fontSize - 2 }}>
                <td style={{ padding: '2px 8px' }}>#</td>
                <td style={{ textAlign: 'right', padding: '2px 4px' }}>Time</td>
                <td style={{ textAlign: 'right', padding: '2px 8px' }}>TPS</td>
              </tr>
            </thead>
            <tbody>
              {reversedSolves.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectSolve(s)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#111')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '3px 8px', color: '#555' }}>{s.isExample ? '★' : s.id}</td>
                  <td style={{ textAlign: 'right', padding: '3px 4px' }}>{fmtTime(s.timeMs)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 8px', color: '#888' }}>{fmtTps(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          right: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 10,
        }}
      />
    </div>
  )
}
```

Key changes from the original:
- Added `onClose?: () => void` to `Props`
- Added `onWidthChange` to `useCallback` deps (was missing)
- Added `className="sidebar-wrapper"` to the desktop sidebar's outer div
- Added early-return overlay path when `onClose` is defined

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/components/SolveHistorySidebar.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SolveHistorySidebar.tsx tests/components/SolveHistorySidebar.test.tsx
git commit -m "feat: add overlay mode to SolveHistorySidebar"
```

---

## Task 3: TimerScreen — mobile layout wiring

**Files:**
- Modify: `src/components/TimerScreen.tsx`

No unit tests — too many hook dependencies to render in isolation.

- [ ] **Step 1: Add `showHistory` state**

After the existing `useState` declarations (around line 75, after `sidebarWidth` state), add:

```tsx
const [showHistory, setShowHistory] = useState(false)
```

- [ ] **Step 2: Add `className="timer-center"` to center column**

Find the div at line ~208 that has `width: 720` and `transform: translateX(...)`. Add the className:

```tsx
        <div className="timer-center" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 720,
          alignSelf: 'center',
          transform: `translateX(${-sidebarWidth / 2}px)`,
          padding: '8px 16px',
        }}>
```

- [ ] **Step 3: Add Solves button at top of center column**

Inside the `timer-center` div, add the Solves button as the first child (before `<ScrambleDisplay ...>`):

```tsx
          <div style={{ alignSelf: 'flex-end' }}>
            <button
              className="solves-btn-mobile"
              onClick={() => setShowHistory(true)}
              style={{ padding: '6px 14px', marginBottom: 4 }}
            >
              Solves
            </button>
          </div>
```

- [ ] **Step 4: Render Solves overlay**

Just before the `{selectedSolve && <SolveDetailModal .../>}` block at the bottom of the return, add:

```tsx
      {showHistory && (
        <SolveHistorySidebar
          solves={solves}
          stats={stats}
          onSelectSolve={(s) => { setSelectedSolve(s); setShowHistory(false) }}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onClose={() => setShowHistory(false)}
        />
      )}
```

- [ ] **Step 5: Run dev server and verify**

```bash
npm run dev
```

Open in browser. Use Chrome DevTools → device toolbar → iPhone 14 preset:
- Sidebar is hidden
- Center column fills full width
- "Solves" button is visible at top-right of the main area
- Tapping "Solves" opens the full-screen overlay
- ✕ closes the overlay
- Tapping a solve row opens `SolveDetailModal` and closes the overlay

Switch to desktop width (>768px):
- Sidebar is visible
- "Solves" button is not visible
- Everything else unchanged

- [ ] **Step 6: Commit**

```bash
git add src/components/TimerScreen.tsx
git commit -m "feat: wire mobile layout in TimerScreen"
```

---

## Task 4: CubeCanvas — touch interaction

**Files:**
- Modify: `src/components/CubeCanvas.tsx`

No unit tests — requires mocking Three.js WebGLRenderer, not practical. Test manually via Chrome DevTools touch simulation.

- [ ] **Step 1: Replace CubeCanvas.tsx**

Replace `src/components/CubeCanvas.tsx` entirely with:

```tsx
import React, { useEffect, useRef } from 'react'
import { CubeRenderer } from '../rendering/CubeRenderer'
import type { FaceHit } from '../rendering/CubeRenderer'
import type { Quaternion, Face } from '../types/cube'

interface Props {
  facelets: string
  quaternion: Quaternion
  onRendererReady?: (renderer: CubeRenderer) => void
  style?: React.CSSProperties
  interactive?: boolean
  onMove?: (face: Face, direction: 'CW' | 'CCW') => void
  onResetOrientation?: (resetFn: () => void) => void
  onOrbit?: (q: { x: number; y: number; z: number; w: number }) => void
}

interface DragState {
  startX: number
  startY: number
  hit: FaceHit | null
}

const MIN_DRAG_PX = 5

export function CubeCanvas({ facelets, quaternion, onRendererReady, style, interactive, onMove, onResetOrientation, onOrbit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const renderer = new CubeRenderer(canvasRef.current)
    rendererRef.current = renderer
    onRendererReady?.(renderer)
    onResetOrientation?.(() => rendererRef.current?.resetOrientation())

    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      renderer.resize(canvas.clientWidth, canvas.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rendererRef.current?.queueFaceletsUpdate(facelets)
  }, [facelets])

  useEffect(() => {
    if (!interactive) rendererRef.current?.setQuaternion(quaternion)
  }, [quaternion, interactive])

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const hit = rendererRef.current.raycastFace(px, py, canvas.clientWidth, canvas.clientHeight)
    dragRef.current = { startX: e.clientX, startY: e.clientY, hit: hit ?? null }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    if (dragRef.current.hit === null) {
      rendererRef.current.applyOrbitDelta(e.movementX, e.movementY)
      onOrbit?.(rendererRef.current.getOrbitQuaternionAsSensorSpace())
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    const { startX, startY, hit } = dragRef.current
    dragRef.current = null

    if (hit !== null) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_PX) return
      const result = rendererRef.current.determineMoveFromDrag(hit, dx, dy)
      if (result) onMove?.(result.face, result.direction)
    }
  }

  const handleMouseLeave = () => {
    dragRef.current = null
  }

  // Touch handlers — identical logic to mouse, adapted for TouchEvent
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !canvasRef.current) return
    const touch = e.touches[0]
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const px = touch.clientX - rect.left
    const py = touch.clientY - rect.top
    const hit = rendererRef.current.raycastFace(px, py, canvas.clientWidth, canvas.clientHeight)
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, hit: hit ?? null }
    lastTouchPos.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current || !lastTouchPos.current) return
    const touch = e.touches[0]
    const movementX = touch.clientX - lastTouchPos.current.x
    const movementY = touch.clientY - lastTouchPos.current.y
    lastTouchPos.current = { x: touch.clientX, y: touch.clientY }
    if (dragRef.current.hit === null) {
      rendererRef.current.applyOrbitDelta(movementX, movementY)
      onOrbit?.(rendererRef.current.getOrbitQuaternionAsSensorSpace())
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    const { startX, startY, hit } = dragRef.current
    dragRef.current = null
    lastTouchPos.current = null

    if (hit !== null) {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_PX) return
      const result = rendererRef.current.determineMoveFromDrag(hit, dx, dy)
      if (result) onMove?.(result.face, result.direction)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="cube-canvas"
      style={{ width: '100%', display: 'block', cursor: interactive ? 'grab' : 'default', touchAction: 'none', ...style }}
      onMouseDown={interactive ? handleMouseDown : undefined}
      onMouseMove={interactive ? handleMouseMove : undefined}
      onMouseUp={interactive ? handleMouseUp : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
      onTouchStart={interactive ? handleTouchStart : undefined}
      onTouchMove={interactive ? handleTouchMove : undefined}
      onTouchEnd={interactive ? handleTouchEnd : undefined}
    />
  )
}
```

Key changes from original:
- Added `lastTouchPos` ref
- Added `handleTouchStart`, `handleTouchMove`, `handleTouchEnd`
- Canvas: added `className="cube-canvas"`, added `touchAction: 'none'`, removed `height: '480px'` (now controlled by CSS class)

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Manual touch test in Chrome DevTools**

1. `npm run dev`, open in Chrome
2. DevTools → device toolbar → iPhone 14 Pro (or similar)
3. Set driver to "Mouse"
4. Drag a face sticker → face turns
5. Drag background → cube orbits
6. Verify specifically: drag top row of front face left-to-right → U face turns CCW

- [ ] **Step 4: Commit**

```bash
git add src/components/CubeCanvas.tsx
git commit -m "feat: add touch interaction to CubeCanvas"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, output in `dist/`.

- [ ] **Step 3: Commit build confirmation (no files to add)**

If both pass:

```bash
git log --oneline -5
```

Expected to see the 4 commits from Tasks 1–4 in the log.
