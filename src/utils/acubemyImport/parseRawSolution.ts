import type { ColorMove, FaceletColor } from '../../types/cube'

// Western color scheme used by acubemy (and our cube hardware).
const LETTER_TO_COLOR: Record<string, FaceletColor> = {
  U: 'W', D: 'Y', F: 'G', B: 'B', L: 'O', R: 'R',
}

/**
 * Parse acubemy's `raw_solution` + `raw_timestamps` into a `ColorMove[]`.
 * Throws on any malformed input so the caller can classify the record as parse-error.
 */
export function parseRawSolution(rawSolution: string, rawTimestamps: number[]): ColorMove[] {
  const tokens = rawSolution.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    throw new Error('raw_solution is empty')
  }
  if (rawTimestamps.length !== tokens.length) {
    throw new Error(`raw_timestamps length (${rawTimestamps.length}) ≠ raw_solution length (${tokens.length})`)
  }

  return tokens.map((token, i) => {
    const letter = token[0]
    const suffix = token.slice(1)
    const color = LETTER_TO_COLOR[letter]
    if (!color || (suffix !== '' && suffix !== "'")) {
      throw new Error(`Invalid token "${token}" at position ${i}`)
    }
    return {
      face: color,
      direction: suffix === "'" ? 'CCW' : 'CW',
      cubeTimestamp: rawTimestamps[i],
      serial: i,
    }
  })
}
