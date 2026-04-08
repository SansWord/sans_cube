import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from '../services/firebase'
import { loadFromStorage, saveToStorage } from '../utils/storage'
import { STORAGE_KEYS } from '../utils/storageKeys'

export interface CloudSyncState {
  enabled: boolean
  user: User | null
  authLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  enable: () => void
  disable: () => void
}

export function useCloudSync(): CloudSyncState {
  const [enabled, setEnabled] = useState<boolean>(
    () => loadFromStorage<boolean>(STORAGE_KEYS.CLOUD_SYNC_ENABLED, false)
  )
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider)
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const enable = useCallback(() => {
    setEnabled(true)
    saveToStorage(STORAGE_KEYS.CLOUD_SYNC_ENABLED, true)
  }, [])

  const disable = useCallback(() => {
    setEnabled(false)
    saveToStorage(STORAGE_KEYS.CLOUD_SYNC_ENABLED, false)
  }, [])

  return { enabled, user, authLoading, signIn, signOut, enable, disable }
}
