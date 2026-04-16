import { useState, useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move } from '../types/cube'
import { useCubeDriverEvent } from './useCubeDriverEvent'
import { SOLVED_FACELETS } from '../types/cube'
import { applyMoveToFacelets, isSolvedFacelets } from '../utils/applyMove'

export function useCubeState(driver: MutableRefObject<CubeDriver | null>, driverVersion = 0) {
  const [facelets, setFacelets] = useState<string>(SOLVED_FACELETS)
  const [isSolved, setIsSolved] = useState(true)
  const faceletsRef = useRef(SOLVED_FACELETS)
  const isSolvedRef = useRef(true)

  const resetState = useCallback(() => {
    driver.current?.resetFacelets?.()
    faceletsRef.current = SOLVED_FACELETS
    isSolvedRef.current = true
    setFacelets(SOLVED_FACELETS)
    setIsSolved(true)
  }, [driver])

  // Saved before each move so replacePreviousMove can revert + re-apply.
  const prevFaceletsRef = useRef<string | null>(null)

  useCubeDriverEvent(driver, 'move', (move) => {
    prevFaceletsRef.current = faceletsRef.current
    const next = applyMoveToFacelets(faceletsRef.current, move)
    const solved = isSolvedFacelets(next)
    faceletsRef.current = next
    isSolvedRef.current = solved
    setFacelets(next)
    setIsSolved(solved)
  }, driverVersion)

  useCubeDriverEvent(driver, 'replacePreviousMove', (move) => {
    if (prevFaceletsRef.current === null) return
    const next = applyMoveToFacelets(prevFaceletsRef.current, move)
    const solved = isSolvedFacelets(next)
    faceletsRef.current = next
    isSolvedRef.current = solved
    prevFaceletsRef.current = null
    setFacelets(next)
    setIsSolved(solved)
  }, driverVersion)

  const handleMove = useCallback((move: Move) => {
    prevFaceletsRef.current = faceletsRef.current
    const next = applyMoveToFacelets(faceletsRef.current, move)
    const solved = isSolvedFacelets(next)
    faceletsRef.current = next
    isSolvedRef.current = solved
    setFacelets(next)
    setIsSolved(solved)
  }, [])

  return { facelets, isSolved, isSolvedRef, resetState, handleMove }
}
