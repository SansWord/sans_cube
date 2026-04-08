import { vi } from 'vitest'

export const getFirestore = vi.fn(() => ({}))
export const collection = vi.fn()
export const doc = vi.fn()
export const getDocs = vi.fn(async () => ({ docs: [] }))
export const setDoc = vi.fn()
export const deleteDoc = vi.fn()
export const query = vi.fn()
export const orderBy = vi.fn()
