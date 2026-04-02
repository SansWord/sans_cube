import { describe, it, expect, beforeEach } from 'vitest'
import { loadFromStorage, saveToStorage } from '../../src/utils/storage'

beforeEach(() => localStorage.clear())

describe('loadFromStorage', () => {
  it('returns fallback when key is absent', () => {
    expect(loadFromStorage('missing', 42)).toBe(42)
    expect(loadFromStorage('missing', [])).toEqual([])
  })

  it('returns parsed value when key exists', () => {
    localStorage.setItem('key', JSON.stringify({ a: 1 }))
    expect(loadFromStorage('key', {})).toEqual({ a: 1 })
  })

  it('returns fallback when stored value is invalid JSON', () => {
    localStorage.setItem('bad', 'not-json{')
    expect(loadFromStorage('bad', 'default')).toBe('default')
  })
})

describe('saveToStorage', () => {
  it('stores JSON-serialised value', () => {
    saveToStorage('key', { x: 2 })
    expect(JSON.parse(localStorage.getItem('key')!)).toEqual({ x: 2 })
  })
})
