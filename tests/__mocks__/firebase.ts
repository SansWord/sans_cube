// Stub Firebase services for unit tests — avoids real Firebase initialization
import { vi } from 'vitest'

export const app = {}
export const auth = {}
export const db = {}
export const googleProvider = {}
export const getAuth = vi.fn(() => ({}))
