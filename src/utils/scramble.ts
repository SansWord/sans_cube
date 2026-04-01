import type { ScrambleStep } from '../types/solve'
import type { Face } from '../types/cube'

export function parseScramble(scramble: string): ScrambleStep[] {
  return scramble.trim().split(/\s+/).filter(Boolean).map(token => {
    const face = token[0] as Face
    const modifier = token.slice(1)
    return {
      face,
      direction: modifier === "'" ? 'CCW' : 'CW',
      double: modifier === '2',
    }
  })
}

export function scrambleStepToString(step: ScrambleStep): string {
  if (step.double) return `${step.face}2`
  if (step.direction === 'CCW') return `${step.face}'`
  return step.face
}
