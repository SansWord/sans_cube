import { describe, it, expect } from 'vitest'
import { parseScramble, scrambleStepToString } from '../../src/utils/scramble'

describe('parseScramble', () => {
  it('parses CW move', () => {
    expect(parseScramble('R')).toEqual([{ face: 'R', direction: 'CW', double: false }])
  })

  it('parses CCW move', () => {
    expect(parseScramble("U'")).toEqual([{ face: 'U', direction: 'CCW', double: false }])
  })

  it('parses double move', () => {
    expect(parseScramble('F2')).toEqual([{ face: 'F', direction: 'CW', double: true }])
  })

  it('parses a full scramble sequence', () => {
    const steps = parseScramble("R U R' U'")
    expect(steps).toHaveLength(4)
    expect(steps[0]).toEqual({ face: 'R', direction: 'CW', double: false })
    expect(steps[1]).toEqual({ face: 'U', direction: 'CW', double: false })
    expect(steps[2]).toEqual({ face: 'R', direction: 'CCW', double: false })
    expect(steps[3]).toEqual({ face: 'U', direction: 'CCW', double: false })
  })

  it('handles extra whitespace', () => {
    expect(parseScramble('  R  U  ')).toHaveLength(2)
  })
})

describe('scrambleStepToString', () => {
  it('formats CW move', () => {
    expect(scrambleStepToString({ face: 'R', direction: 'CW', double: false })).toBe('R')
  })

  it('formats CCW move', () => {
    expect(scrambleStepToString({ face: 'U', direction: 'CCW', double: false })).toBe("U'")
  })

  it('formats double move', () => {
    expect(scrambleStepToString({ face: 'F', direction: 'CW', double: true })).toBe('F2')
  })
})
