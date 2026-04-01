# Mobile & Touch Support Design

**Date:** 2026-04-01

## Goal

Make the app usable on smartphones: responsive layout that fits small screens, and touch interaction on the 3D cube that behaves identically to mouse drag.

---

## Feature 1: Responsive Layout

### Breakpoint

`≤ 768px` = mobile. All changes are CSS-driven via a `@media (max-width: 768px)` block in `index.css`.

### Desktop (unchanged)

- Left sidebar visible, resizable
- Center column fixed at `width: 720px`, offset by `translateX(-sidebarWidth/2)` to center between sidebar and right edge

### Mobile layout

- Sidebar hidden (`display: none`)
- Center column goes full-width (remove `width: 720`, remove `translateX` offset)
- Canvas height reduced (e.g. `300px`) to leave room for scramble and timer above

### "Solves" button

- Visible only on mobile (`display: none` on desktop, `display: block` at ≤ 768px)
- Placed in `ConnectionBar` on the right side
- Tapping it opens the Solves overlay

### Solves overlay (mobile only)

Full-screen `position: fixed` panel that covers the timer screen:

- **Header row:** "Solves" label left, ✕ close button right
- **Statistics section:** pinned at top (not scrollable)
- **Solve list:** scrolls independently below statistics; newest solve at top
- Tapping a solve row opens the existing `SolveDetailModal` (unchanged)
- ✕ closes overlay, returns to timer

### Files changed

| File | Change |
|------|--------|
| `src/index.css` | Add `@media (max-width: 768px)` rules |
| `src/components/TimerScreen.tsx` | Add `showHistory` state; render sidebar as fixed overlay when true; pass "Solves" button to ConnectionBar |
| `src/components/ConnectionBar.tsx` | Accept optional `onShowHistory` prop; render "Solves" button (mobile-only via CSS class) |
| `src/components/SolveHistorySidebar.tsx` | Accept optional `onClose` prop; when present, render with ✕ button and overlay styles |

---

## Feature 2: Touch Interaction on the 3D Cube

### Behavior

Touch gestures are identical to mouse gestures:

- **Finger down on a face, drag** → turns that face. Direction and CW/CCW are determined by `CubeRenderer.determineMoveFromDrag(hit, dx, dy)` — same function used by mouse.
- **Finger down on background, drag** → orbits the camera via `CubeRenderer.applyOrbitDelta(dx, dy)`.

Example: drag the top row of the front face left-to-right → U CCW. This is already the correct output of `determineMoveFromDrag` for that input.

### Activation

Touch handlers are active whenever `interactive === true` — the same condition as mouse handlers. So selecting "Mouse" driver on mobile enables touch-to-turn automatically.

### Implementation (`CubeCanvas.tsx`)

Add a `lastTouchPos` ref (`{ x: number; y: number } | null`) alongside the existing `dragRef` to track previous touch position for orbit delta computation (touch events have no `movementX`).

**`onTouchStart`**
1. `e.preventDefault()`
2. Get `touch = e.touches[0]`
3. Compute canvas-relative pixel coords from `touch.clientX/Y` and `canvas.getBoundingClientRect()`
4. Raycast via `raycastFace` — same as `handleMouseDown`
5. Set `dragRef.current = { startX: touch.clientX, startY: touch.clientY, hit }`
6. Set `lastTouchPos.current = { x: touch.clientX, y: touch.clientY }`

**`onTouchMove`**
1. `e.preventDefault()`
2. Get `touch = e.touches[0]`
3. Compute `movementX = touch.clientX - lastTouchPos.x`, `movementY = touch.clientY - lastTouchPos.y`
4. Update `lastTouchPos.current`
5. If `dragRef.current.hit === null`: call `applyOrbitDelta(movementX, movementY)` and emit `onOrbit`
6. (Face drag delta is computed at touchend, not during move)

**`onTouchEnd`**
1. `e.preventDefault()`
2. Read `startX/Y` and `hit` from `dragRef.current`, then clear it
3. If `hit !== null`: compute `dx = e.changedTouches[0].clientX - startX`, `dy = ...`, call `determineMoveFromDrag(hit, dx, dy)`, emit `onMove`

**Canvas style**

Add `touch-action: none` to the canvas element to prevent the browser from intercepting touch events for scroll/zoom.

### Files changed

| File | Change |
|------|--------|
| `src/components/CubeCanvas.tsx` | Add `lastTouchPos` ref; add `onTouchStart`, `onTouchMove`, `onTouchEnd` handlers; add `touch-action: none` to canvas style |

---

## Out of scope

- Multi-touch (pinch-to-zoom, two-finger gestures)
- Landscape-specific layout adjustments
- iOS PWA / "Add to Home Screen" configuration
