import { useState, useEffect, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, SolveSession } from '../types/cube'
import { useCubeDriverEvent } from './useCubeDriverEvent'

type Entry = { move: Move; cubeTimestamp: number }

export function buildSolveSession(entries: Entry[]): SolveSession | null {
  if (entries.length === 0) return null
  return {
    moves: entries,
    startTimestamp: entries[0].cubeTimestamp,
    endTimestamp: entries[entries.length - 1].cubeTimestamp,
  }
}

export function useSolveRecorder(
  driver: MutableRefObject<CubeDriver | null>,
  isSolved: boolean,
  driverVersion = 0,
) {
  const [lastSession, setLastSession] = useState<SolveSession | null>(null)
  const isRecording = useRef(false)
  const entries = useRef<Entry[]>([])
  const wasSolvedRef = useRef(true)

  // When cube becomes solved while recording, finalize the session
  useEffect(() => {
    if (isSolved && isRecording.current) {
      const session = buildSolveSession(entries.current)
      if (session) setLastSession(session)
      isRecording.current = false
      entries.current = []
    }
    wasSolvedRef.current = isSolved
  }, [isSolved])

  useCubeDriverEvent(driver, 'move', (move) => {
    // Start recording on first move after cube was solved
    if (wasSolvedRef.current && !isRecording.current) {
      isRecording.current = true
      entries.current = []
    }
    if (isRecording.current) {
      entries.current.push({ move, cubeTimestamp: move.cubeTimestamp })
    }
  }, driverVersion)

  useCubeDriverEvent(driver, 'replacePreviousMove', (move) => {
    if (!isRecording.current || entries.current.length === 0) return
    entries.current.pop()
    entries.current.push({ move, cubeTimestamp: move.cubeTimestamp })
  }, driverVersion)

  const clearSession = useCallback(() => setLastSession(null), [])

  return { lastSession, clearSession }
}
