import { vi } from 'vitest'

export const getAuth = vi.fn(() => ({}))
export class GoogleAuthProvider {}
export const signInWithPopup = vi.fn()
export const signOut = vi.fn()
export const onAuthStateChanged = vi.fn()
export const signInAnonymously = vi.fn()
