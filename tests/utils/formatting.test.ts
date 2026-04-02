import { describe, it, expect } from 'vitest'
import { formatTime, formatSeconds, formatTps } from '../../src/utils/formatting'

describe('formatTime', () => {
  it('formats ms with s suffix', () => {
    expect(formatTime(9990)).toBe('9.99s')
    expect(formatTime(0)).toBe('0.00s')
    expect(formatTime(60000)).toBe('60.00s')
  })
})

describe('formatSeconds', () => {
  it('formats ms without unit', () => {
    expect(formatSeconds(9990)).toBe('9.99')
    expect(formatSeconds(0)).toBe('0.00')
  })
  it('returns — for null', () => {
    expect(formatSeconds(null)).toBe('—')
  })
})

describe('formatTps', () => {
  it('computes turns per second', () => {
    expect(formatTps(10, 2000)).toBe('5.00')
    expect(formatTps(15, 3000)).toBe('5.00')
  })
  it('returns — when ms is 0', () => {
    expect(formatTps(5, 0)).toBe('—')
  })
})
