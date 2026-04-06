# URL Auto-Play for Example Solves

**Date:** 2026-04-06

## Problem

When a visitor arrives at the site via a shared link like `https://sansword.github.io/sans_cube/#solve--2`, the solve detail modal opens automatically. But the replay doesn't start — the visitor has to find and press Play manually, which isn't obvious.

## Goal

When the page loads with `#solve--1` or `#solve--2` in the URL, pause briefly, then auto-start the replay. Only for those two example solve IDs. Only on initial page load — not when a user manually clicks an example solve in the sidebar later.

## Design

### Tunable constant

In `SolveDetailModal.tsx`, near the top:

```ts
const AUTO_PLAY_DELAY_MS = 2000
```

### TimerScreen changes

Add a ref that captures whether the page loaded with an example-solve hash:

```ts
const autoPlayFromUrlRef = useRef(
  !!window.location.hash.match(/^#solve-(-[12])$/)
)
```

Pass `autoPlay={autoPlayFromUrlRef.current}` to `SolveDetailModal`.

Clear `autoPlayFromUrlRef.current = false` in the `onClose` handler so that if the user closes and manually reopens the same example solve, it won't auto-play again.

### SolveDetailModal changes

Add `autoPlay?: boolean` to the `Props` interface.

Add a `useEffect`:

```ts
useEffect(() => {
  if (!autoPlay) return
  const t = setTimeout(() => play(), AUTO_PLAY_DELAY_MS)
  return () => clearTimeout(t)
}, [autoPlay, play])
```

- Delay starts when the modal mounts (i.e. when it appears on screen).
- If the modal is closed before the 2 seconds are up, React unmounts it and the cleanup runs `clearTimeout`, cancelling the replay.

## Constraints

- Only `#solve--1` and `#solve--2` trigger auto-play. Any other solve ID (including future example slots) does not.
- One-shot: auto-play fires at most once per page load. Closing and reopening the modal will not replay.
- No new state — uses a `useRef` to avoid an extra re-render.
