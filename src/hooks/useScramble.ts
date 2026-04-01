import { useState, useCallback, useEffect } from 'react'
import type { ScrambleStep } from '../types/solve'
import { parseScramble } from '../utils/scramble'

const FACES = ['U', 'D', 'F', 'B', 'R', 'L'] as const
const OPPOSITE: Record<string, string> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' }
const MODIFIERS = ['', "'", '2'] as const

function generateScramble(): string {
  const moves: string[] = []
  let lastFace = ''
  let secondLastFace = ''
  while (moves.length < 20) {
    const face = FACES[Math.floor(Math.random() * 6)]
    // Skip same face or opposite face after same axis (e.g. U D U)
    if (face === lastFace) continue
    if (face === OPPOSITE[lastFace] && secondLastFace === face) continue
    const mod = MODIFIERS[Math.floor(Math.random() * 3)]
    moves.push(face + mod)
    secondLastFace = lastFace
    lastFace = face
  }
  return moves.join(' ')
}

export function useScramble() {
  const [scramble, setScramble] = useState<string | null>(null)
  const [steps, setSteps] = useState<ScrambleStep[]>([])

  const regenerate = useCallback(() => {
    const s = generateScramble()
    setScramble(s)
    setSteps(parseScramble(s))
  }, [])

  useEffect(() => {
    regenerate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { scramble, steps, regenerate }
}
