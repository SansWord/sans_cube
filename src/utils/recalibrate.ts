import type { SolveRecord } from '../types/solve'

/**
 * Recalibrates timeMs for stored solve records using hardware cubeTimestamps.
 *
 * Before v1.52, timeMs was computed from Date.now() at BLE event delivery, which
 * could inflate times by ~1s when the last move (often an M/M' in Roux) arrived
 * late via the retro BLE path. The hardware cubeTimestamp records when the move
 * physically happened, so the span of cubeTimestamps is the true solve duration.
 *
 * Only corrects (reduces) timeMs — never inflates. Skips example solves (id < 0)
 * and records with fewer than 2 moves.
 */
export function recalibrateSolveTimes(solves: SolveRecord[]): SolveRecord[] {
  return solves.map((solve) => {
    if (solve.id < 0) return solve
    if (!solve.moves || solve.moves.length < 2) return solve

    const hwTimeMs =
      solve.moves[solve.moves.length - 1].cubeTimestamp - solve.moves[0].cubeTimestamp

    if (hwTimeMs <= 0 || hwTimeMs >= solve.timeMs) return solve

    return { ...solve, timeMs: hwTimeMs }
  })
}
