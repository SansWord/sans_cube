# Phase Bar Hover Indicator — Design Spec

**Date:** 2026-04-01

## Summary

When a user hovers over (desktop) or tap-drags (mobile) the interactive `PhaseBar`, a vertical indicator line tracks their cursor/finger position along the bar — identical in appearance to the existing replay playhead used in the solve detail modal.

## Scope

Single file change: `src/components/PhaseBar.tsx`. No callers need updating.

## State

Add one new state variable inside `PhaseBar`:

```ts
const [hoverPct, setHoverPct] = useState<number | null>(null)
```

`null` means the user is not hovering or touching. A value of 0–100 is the percentage position along the bar.

## Helper

```ts
function calcPct(clientX: number, el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
}
```

## Event Handlers (on bar container `<div>`, only when `interactive`)

| Event | Action |
|---|---|
| `onMouseMove` | `setHoverPct(calcPct(e.clientX, e.currentTarget))` |
| `onMouseLeave` | `setHoverPct(null)` |
| `onTouchMove` | `setHoverPct(calcPct(e.touches[0].clientX, e.currentTarget))` |
| `onTouchEnd` | `setHoverPct(null)` |

## Rendering

When `hoverPct !== null`, render a second absolute-positioned indicator line in the same container as the existing `indicatorPct` playhead:

- Width: 2px
- Height: 24px (full bar height)
- Color: white (`#fff`)
- Style: same as `indicatorPct` line — `borderRadius: 1`, `pointerEvents: none`, `boxShadow: '0 0 4px rgba(0,0,0,0.6)'`, `transform: 'translateX(-1px)'`
- Position: `left: ${hoverPct}%`

The existing `indicatorPct` playhead is unchanged.

## Non-goals

- No time label near the indicator line.
- No changes to the modal's PhaseBar (it uses `interactive={false}`, so no hover events fire).
- No scrubbing/seeking behavior — the line is purely visual.
