// src/utils/recomputePhases.ts
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets, isSolvedFacelets } from './applyMove'
import { parseScramble } from './scramble'
import type { SolveRecord, PhaseRecord, SolveMethod } from '../types/solve'
import type { Move } from '../types/cube'

function computeScrambledFacelets(scramble: string): string {
  let f = SOLVED_FACELETS
  for (const step of parseScramble(scramble)) {
    const move = { face: step.face, direction: step.direction, cubeTimestamp: 0, serial: 0 }
    f = applyMoveToFacelets(f, move)
    if (step.double) f = applyMoveToFacelets(f, move)
  }
  return f
}

// Exported for use by migrateSolveV1toV2 (Part 2). Not for general use.
export function computePhases(
  moves: Move[],
  scramble: string,
  method: SolveMethod
): PhaseRecord[] | null {
  if (moves.length === 0) return null

  // Null cubeTimestamps (retroactively-detected M-pair moves) coerce to 0 and
  // produce negative phase durations. Fill nulls with the nearest non-null
  // neighbour so timing stays monotonic.
  const timestamps: number[] = moves.map((m) => (m.cubeTimestamp as number | null) ?? -1)
  let lastValid = timestamps.find((t) => t >= 0) ?? 0
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] < 0) timestamps[i] = lastValid
    else lastValid = timestamps[i]
  }

  let facelets = computeScrambledFacelets(scramble)
  const phases: PhaseRecord[] = []
  let phaseIndex = 0
  let phaseStart = timestamps[0]
  let phaseFirstMove: number | null = null
  let phaseMoveCount = 0

  function completePhase(endTimestamp: number) {
    const ph = method.phases[phaseIndex]
    const firstMove = phaseFirstMove ?? endTimestamp
    phases.push({
      label: ph.label,
      group: ph.group,
      recognitionMs: firstMove - phaseStart,
      executionMs: endTimestamp - firstMove,
      turns: phaseMoveCount,
    })
    phaseIndex++
    phaseStart = endTimestamp
    phaseFirstMove = null
    phaseMoveCount = 0
  }

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const ts = timestamps[i]
    facelets = applyMoveToFacelets(facelets, move)
    phaseMoveCount++
    if (phaseFirstMove === null) phaseFirstMove = ts

    while (phaseIndex < method.phases.length) {
      if (method.phases[phaseIndex].isComplete(facelets)) {
        completePhase(ts)
      } else {
        break
      }
    }

    if (isSolvedFacelets(facelets)) {
      while (phaseIndex < method.phases.length) {
        completePhase(ts)
      }
      break
    }
  }

  if (!isSolvedFacelets(facelets)) return null

  // CFOP merge rules
  const eollIdx = phases.findIndex((p) => p.label === 'EOLL')
  if (eollIdx >= 0 && eollIdx + 1 < phases.length &&
      phases[eollIdx + 1].label === 'COLL' && phases[eollIdx + 1].turns === 0) {
    const eoll = phases[eollIdx]
    phases.splice(eollIdx, 2,
      { ...eoll, recognitionMs: 0, executionMs: 0, turns: 0 },
      { ...phases[eollIdx + 1], recognitionMs: eoll.recognitionMs, executionMs: eoll.executionMs, turns: eoll.turns },
    )
  }

  const n2 = phases.length
  if (n2 >= 2 && phases[n2 - 2].label === 'CPLL' && phases[n2 - 1].label === 'EPLL' && phases[n2 - 1].turns === 0) {
    const cpll = phases[n2 - 2]
    phases.splice(n2 - 2, 2,
      { ...cpll, recognitionMs: 0, executionMs: 0, turns: 0 },
      { ...phases[n2 - 1], recognitionMs: cpll.recognitionMs, executionMs: cpll.executionMs, turns: cpll.turns },
    )
  }

  return phases
}

export function recomputePhases(solve: SolveRecord, newMethod: SolveMethod): PhaseRecord[] | null {
  return computePhases(solve.moves, solve.scramble, newMethod)
}
