import { describe, it, expect, vi } from 'vitest'
import type { User } from 'firebase/auth'
import type { SolveRecord } from '../../src/types/solve'
import type { CloudConfig } from '../../src/stores/solveStore'

// Tests the anon-provisioning logic that TimerScreen.tsx uses in its onShare callback.
// If the callback logic in TimerScreen changes, update this test to match.

function makeCloudConfig(overrides: Partial<CloudConfig> = {}): CloudConfig {
  return {
    enabled: false,
    user: null,
    signInAnonymously: vi.fn(),
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return { uid: 'uid-123', email: 'a@b.com', isAnonymous: false, ...overrides } as unknown as User
}

function makeSolve(): SolveRecord {
  return { id: 1, seq: 1, scramble: '', timeMs: 1000, moves: [], phases: [], date: 1, schemaVersion: 2 }
}

// Reproduce the onShare logic from TimerScreen.tsx inline
async function timerScreenOnShare(
  cloudConfig: CloudConfig | undefined,
  shareSolveFn: (uid: string, solve: SolveRecord) => Promise<string>,
  solve: SolveRecord
): Promise<string> {
  let uid = cloudConfig?.user?.uid
  if (!uid) {
    if (!cloudConfig?.signInAnonymously) throw new Error('cloud config unavailable')
    const anon = await cloudConfig.signInAnonymously()
    uid = anon.uid
  }
  return shareSolveFn(uid, solve)
}

describe('TimerScreen — onShare anon provisioning', () => {
  it('calls signInAnonymously then shareSolve with anon uid when user is null', async () => {
    const anonUser = makeUser({ uid: 'anon-uid-xyz', isAnonymous: true })
    const mockSignInAnonymously = vi.fn().mockResolvedValue(anonUser)
    const mockShareSolve = vi.fn().mockResolvedValue('share-id-abc')
    const config = makeCloudConfig({ user: null, signInAnonymously: mockSignInAnonymously })

    const result = await timerScreenOnShare(config, mockShareSolve, makeSolve())

    expect(mockSignInAnonymously).toHaveBeenCalledOnce()
    expect(mockShareSolve).toHaveBeenCalledWith('anon-uid-xyz', expect.any(Object))
    expect(result).toBe('share-id-abc')
  })

  it('skips signInAnonymously and uses existing uid when already signed in', async () => {
    const googleUser = makeUser({ uid: 'google-uid-abc', isAnonymous: false })
    const mockSignInAnonymously = vi.fn()
    const mockShareSolve = vi.fn().mockResolvedValue('share-id-def')
    const config = makeCloudConfig({ user: googleUser, signInAnonymously: mockSignInAnonymously })

    await timerScreenOnShare(config, mockShareSolve, makeSolve())

    expect(mockSignInAnonymously).not.toHaveBeenCalled()
    expect(mockShareSolve).toHaveBeenCalledWith('google-uid-abc', expect.any(Object))
  })
})
