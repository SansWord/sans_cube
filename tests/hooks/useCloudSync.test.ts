import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { onAuthStateChanged, signInAnonymously as fbSignInAnonymously } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { STORAGE_KEYS } from '../../src/utils/storageKeys'

// firebase/auth is aliased to tests/__mocks__/firebase-auth.ts by vitest.config.ts
vi.mock('../../src/services/firebase', () => ({ auth: {}, googleProvider: {} }))
vi.mock('../../src/services/analytics', () => ({
  setAnalyticsUser: vi.fn(),
  logCloudSyncEnabled: vi.fn(),
}))

import { useCloudSync } from '../../src/hooks/useCloudSync'

const mockOnAuthStateChanged = vi.mocked(onAuthStateChanged)
const mockFbSignInAnonymously = vi.mocked(fbSignInAnonymously)

function simulateAuthChange(user: User | null) {
  const calls = mockOnAuthStateChanged.mock.calls
  const callback = calls[calls.length - 1][1] as (u: User | null) => void
  act(() => { callback(user) })
}

function makeUser(overrides: Partial<User>): User {
  return { uid: 'uid-123', email: 'test@example.com', isAnonymous: false, ...overrides } as unknown as User
}

describe('useCloudSync — anonymous auth handling', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockOnAuthStateChanged.mockReturnValue(vi.fn()) // no-op unsubscribe
  })

  it('forces enabled=false and clears storage when auth state is anonymous', () => {
    localStorage.setItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED, 'true')
    const { result } = renderHook(() => useCloudSync())
    simulateAuthChange(makeUser({ uid: 'anon-uid', isAnonymous: true }))
    expect(result.current.enabled).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED)).toBe('false')
  })

  it('does not force enabled=false for a Google user', () => {
    localStorage.setItem(STORAGE_KEYS.CLOUD_SYNC_ENABLED, 'true')
    const { result } = renderHook(() => useCloudSync())
    simulateAuthChange(makeUser({ uid: 'google-uid', isAnonymous: false }))
    expect(result.current.enabled).toBe(true)
  })

  it('exposes signInAnonymously that calls firebase and returns the user', async () => {
    const fakeUser = makeUser({ uid: 'anon-uid', isAnonymous: true })
    mockFbSignInAnonymously.mockResolvedValue({ user: fakeUser } as any)
    const { result } = renderHook(() => useCloudSync())
    simulateAuthChange(null)
    let returned: User | undefined
    await act(async () => {
      returned = await result.current.signInAnonymously()
    })
    expect(mockFbSignInAnonymously).toHaveBeenCalledOnce()
    expect(returned?.uid).toBe('anon-uid')
  })
})
