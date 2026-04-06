# Auto-Play on Solve Detail Modal Open

**Date:** 2026-04-06

## Goal

Whenever the solve detail modal opens (for any solve), auto-start the replay after a short delay. If the modal is closed before the delay expires, cancel the replay.

## Design

### Tunable constant

In `SolveDetailModal.tsx`, near the top:

```ts
const AUTO_PLAY_DELAY_MS = 2000
```

### SolveDetailModal changes only

Add a `useEffect` that schedules `play()` when the modal mounts:

```ts
useEffect(() => {
  const t = setTimeout(() => play(), AUTO_PLAY_DELAY_MS)
  return () => clearTimeout(t)
}, [play])
```

- Delay starts when the modal mounts.
- If the modal is closed before 2 seconds, React unmounts it and the cleanup cancels the timeout.
- No props changes, no `TimerScreen` changes.
