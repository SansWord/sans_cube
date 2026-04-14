import { describe, it, expect } from 'vitest'
import { newShareId, SHARE_ID_RE } from '../../src/services/firestoreSharing'

describe('SHARE_ID_RE', () => {
  it('accepts a valid 20-char base62 ID', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQxZ7wLdUvTy')).toBe(true)
  })

  it('rejects IDs shorter than 20 chars', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQx')).toBe(false)
  })

  it('rejects IDs longer than 20 chars', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQxZ7wLdUvTyXX')).toBe(false)
  })

  it('rejects IDs with non-base62 characters', () => {
    expect(SHARE_ID_RE.test('aB3kR9mNpQ-Z7wLdUvTy')).toBe(false)
    expect(SHARE_ID_RE.test('aB3kR9mNpQ_Z7wLdUvTy')).toBe(false)
  })
})

describe('newShareId', () => {
  it('returns a 20-char base62 string', () => {
    const id = newShareId()
    expect(id).toMatch(SHARE_ID_RE)
  })

  it('returns unique IDs on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => newShareId()))
    expect(ids.size).toBe(20)
  })
})
