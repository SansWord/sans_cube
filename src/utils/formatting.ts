/**
 * Format milliseconds as `9.99s` — used in analysis/detail views.
 */
export function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2) + 's'
}

/**
 * Format milliseconds as `9.99` (no unit) — used in timer display and solve lists.
 * Returns `—` for null.
 */
export function formatSeconds(ms: number | null): string {
  if (ms === null) return '—'
  return (ms / 1000).toFixed(2)
}

/**
 * Format turns-per-second given turn count and duration in ms.
 * Returns `—` when duration is 0.
 */
export function formatTps(turns: number, ms: number): string {
  if (ms === 0) return '—'
  return (turns / (ms / 1000)).toFixed(2)
}
