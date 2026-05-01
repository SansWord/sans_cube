import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'

// firebase/auth is globally aliased by vitest.config.ts; services need explicit mocks
vi.mock('../../src/services/firebase', () => ({ auth: {}, googleProvider: {}, db: {}, app: {} }))
vi.mock('../../src/services/firestoreSolves', () => ({
  loadSolvesFromFirestore: vi.fn(),
  addSolveToFirestore: vi.fn(),
  updateSolveInFirestore: vi.fn(),
  deleteSolveFromFirestore: vi.fn(),
  loadNextSeqFromFirestore: vi.fn(),
  updateCounterInFirestore: vi.fn(),
  migrateLocalSolvesToFirestore: vi.fn(),
  bulkUpdateSolvesInFirestore: vi.fn(),
  renumberSolvesInFirestore: vi.fn(),
  recalibrateSolvesInFirestore: vi.fn(),
  migrateSolvesToV2InFirestore: vi.fn(),
}))
vi.mock('../../src/services/firestoreSharing', () => ({
  shareSolve: vi.fn(),
  unshareSolve: vi.fn(),
  isSharedSolveOwner: vi.fn(),
  loadSharedSolve: vi.fn(),
  updateSharedSolve: vi.fn(),
}))
vi.mock('../../src/services/analytics', () => ({
  setAnalyticsUser: vi.fn(),
  logCloudSyncEnabled: vi.fn(),
  logCubeConnected: vi.fn(),
  logCubeFirstMove: vi.fn(),
  logSolveShared: vi.fn(),
  logConsentGranted: vi.fn(),
  logConsentDeclined: vi.fn(),
  logConsentShown: vi.fn(),
}))
vi.mock('../../src/components/CubeCanvas', () => ({ CubeCanvas: () => <div data-testid="cube-canvas" /> }))
vi.mock('../../src/components/TimerScreen', () => ({ TimerScreen: () => <div data-testid="timer-screen" /> }))
vi.mock('../../src/components/ConnectionBar', () => ({ ConnectionBar: () => <div /> }))
vi.mock('../../src/components/ControlBar', () => ({ ControlBar: () => <div /> }))
vi.mock('../../src/components/MoveHistory', () => ({ MoveHistory: () => <div /> }))
vi.mock('../../src/components/FaceletDebug', () => ({ FaceletDebug: () => <div /> }))
vi.mock('../../src/components/OrientationConfig', () => ({ OrientationConfig: () => <div /> }))
vi.mock('../../src/components/AnalyticsBanner', () => ({ AnalyticsBanner: () => <div /> }))
vi.mock('../../src/hooks/useCubeDriver', () => ({
  useCubeDriver: () => ({
    driver: null, connect: vi.fn(), disconnect: vi.fn(),
    status: 'disconnected', driverType: 'mouse', switchDriver: vi.fn(), driverVersion: 0,
  }),
}))
vi.mock('../../src/hooks/useCubeState', () => ({
  useCubeState: () => ({
    facelets: '', isSolved: false, isSolvedRef: { current: false },
    resetState: vi.fn(), resetCenterPositions: vi.fn(), handleMove: vi.fn(),
  }),
}))
vi.mock('../../src/hooks/useGyro', () => ({
  useGyro: () => ({
    quaternion: null, config: { front: 'G', bottom: 'Y' },
    resetGyro: vi.fn(), resetSensorOffset: vi.fn(), saveOrientationConfig: vi.fn(),
    sensorStateRef: { current: 'HOME' },
  }),
}))
vi.mock('../../src/hooks/useGestureDetector', () => ({ useGestureDetector: () => {} }))
vi.mock('../../src/hooks/useSolveRecorder', () => ({
  useSolveRecorder: () => ({ solveStarted: false }),
}))
vi.mock('../../src/hooks/useCubeDriverEvent', () => ({ useCubeDriverEvent: () => {} }))
vi.mock('../../src/hooks/useSolveStore', () => ({
  useSolveStore: () => ({ solves: [], cloudLoading: false, status: 'idle' }),
}))
vi.mock('../../src/hooks/useHashRouter', () => ({
  useHashRouter: () => ({ currentRoute: { type: 'debug' }, navigate: vi.fn() }),
  parseHash: vi.fn(() => ({ type: 'debug' })),
  decideSelectedSolveUrlAction: vi.fn(),
  decideSharedSolveUrlAction: vi.fn(),
}))
vi.mock('../../src/stores/solveStore', () => ({
  solveStore: {
    configure: vi.fn(),
    getSnapshot: () => ({ solves: [] }),
    reloadLocal: vi.fn(),
    runBulkOp: vi.fn(),
    reload: vi.fn(),
  },
  __resetForTests: vi.fn(),
}))

// useCloudSync is mocked per-test to control the auth state
vi.mock('../../src/hooks/useCloudSync')

import { useCloudSync } from '../../src/hooks/useCloudSync'
import App from '../../src/App'

function makeCloudSyncState(userOverrides: Partial<User> | null) {
  const user = userOverrides
    ? { uid: 'uid', email: null, isAnonymous: false, ...userOverrides } as unknown as User
    : null
  return {
    enabled: false,
    user,
    authLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    signInAnonymously: vi.fn(),
  }
}

describe('App debug panel — anon user auth display', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.location.hash = '#debug'
  })

  it('shows "Sign in with Google" for an anonymous user, not "Signed in as"', () => {
    vi.mocked(useCloudSync).mockReturnValue(
      makeCloudSyncState({ uid: 'anon-uid', isAnonymous: true })
    )
    render(<App />)
    expect(screen.queryByText(/Signed in as/i)).toBeNull()
    expect(screen.getByText(/Sign in with Google/i)).toBeInTheDocument()
  })

  it('shows "Signed in as {email}" for a Google user', () => {
    vi.mocked(useCloudSync).mockReturnValue(
      makeCloudSyncState({ uid: 'google-uid', isAnonymous: false, email: 'user@gmail.com' } as any)
    )
    render(<App />)
    expect(screen.getByText(/Signed in as user@gmail.com/i)).toBeInTheDocument()
    expect(screen.queryByText(/Sign in with Google/i)).toBeNull()
  })
})
