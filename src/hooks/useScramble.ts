import { useState, useCallback, useEffect } from 'react'
import type { ScrambleStep } from '../types/solve'
import { parseScramble } from '../utils/scramble'

async function generateScramble(): Promise<string> {
  const { randomScrambleForEvent } = await import('cubing/scramble')
  const alg = await randomScrambleForEvent('333')
  return alg.toString()
}

export function useScramble() {
  const [scramble, setScramble] = useState<string | null>(null)
  const [steps, setSteps] = useState<ScrambleStep[]>([])

  const regenerate = useCallback(() => {
    setScramble(null)
    setSteps([])
    generateScramble().then((s) => {
      setScramble(s)
      setSteps(parseScramble(s))
    })
  }, [])

  useEffect(() => {
    regenerate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { scramble, steps, regenerate }
}
