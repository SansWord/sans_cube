import { logEvent, setUserId as firebaseSetUserId } from 'firebase/analytics'
import { analytics } from './firebase'

export function logSharedSolveViewed(shareId: string): void {
  if (!analytics) return
  logEvent(analytics, 'shared_solve_viewed', { share_id: shareId })
}

export function logSolveShared(method: string): void {
  if (!analytics) return
  logEvent(analytics, 'solve_shared', { method })
}

export function logSolveRecorded(method: string): void {
  if (!analytics) return
  logEvent(analytics, 'solve_recorded', { method })
}

export function logCubeConnected(): void {
  if (!analytics) return
  logEvent(analytics, 'cube_connected')
}

export function logCubeFirstMove(driver: 'ble' | 'mouse' | 'touch'): void {
  if (!analytics) return
  logEvent(analytics, 'cube_first_move', { driver })
}

export function logCloudSyncEnabled(): void {
  if (!analytics) return
  logEvent(analytics, 'cloud_sync_enabled')
}

export function setAnalyticsUser(uid: string | null): void {
  if (!analytics) return
  firebaseSetUserId(analytics, uid)
}
