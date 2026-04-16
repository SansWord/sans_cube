// src/utils/recomputePhases.ts
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets, isSolvedFacelets } from './applyMove'
import { parseScramble } from './scramble'
import type { SolveRecord, PhaseRecord, SolveMethod } from '../types/solve'

function computeScrambledFacelets(scramble: string): string {
  let f = SOLVED_FACELETS
  for (const step of parseScramble(scramble)) {
    const move = { face: step.face, direction: step.direction, cubeTimestamp: 0, serial: 0 }
    f = applyMoveToFacelets(f, move)
    if (step.double) f = applyMoveToFacelets(f, move)
  }
  return f
}

export function recomputePhases(solve: SolveRecord, newMethod: SolveMethod): PhaseRecord[] | null {
  const moves = solve.moves
  if (moves.length === 0) return null

  let facelets = computeScrambledFacelets(solve.scramble)

  const phases: PhaseRecord[] = []
  let phaseIndex = 0
  let phaseStart = moves[0].cubeTimestamp
  let phaseFirstMove: number | null = null
  let phaseMoveCount = 0

  function completePhase(endTimestamp: number) {
    const ph = newMethod.phases[phaseIndex]
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

  for (const move of moves) {
    facelets = applyMoveToFacelets(facelets, move)
    phaseMoveCount++
    if (phaseFirstMove === null) phaseFirstMove = move.cubeTimestamp

    while (phaseIndex < newMethod.phases.length) {
      if (newMethod.phases[phaseIndex].isComplete(facelets)) {
        completePhase(move.cubeTimestamp)
      } else {
        break
      }
    }

    if (isSolvedFacelets(facelets)) {
      // Complete any remaining phases not caught by the while loop
      while (phaseIndex < newMethod.phases.length) {
        completePhase(move.cubeTimestamp)
      }
      break
    }
  }

  if (!isSolvedFacelets(facelets)) return null

  // CFOP merge rules — matched by label, no-op for non-CFOP methods
  // Rule 1: if EOLL completed OLL on the same move (COLL has 0 turns), absorb EOLL into COLL
  const eollIdx = phases.findIndex((p) => p.label === 'EOLL')
  if (eollIdx >= 0 && eollIdx + 1 < phases.length &&
      phases[eollIdx + 1].label === 'COLL' && phases[eollIdx + 1].turns === 0) {
    const eoll = phases[eollIdx]
    phases.splice(eollIdx, 2,
      { ...eoll, recognitionMs: 0, executionMs: 0, turns: 0 },
      { ...phases[eollIdx + 1], recognitionMs: eoll.recognitionMs, executionMs: eoll.executionMs, turns: eoll.turns },
    )
  }

  // Rule 2: if CPLL and EPLL finished on the same move (EPLL has 0 turns), absorb CPLL into EPLL
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
