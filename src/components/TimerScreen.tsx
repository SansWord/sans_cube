import { useRef, useState, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { ConnectionStatus } from '../drivers/CubeDriver'
import { STORAGE_KEYS } from '../utils/storageKeys'
import type { SolveRecord } from '../types/solve'
import { useScramble } from '../hooks/useScramble'
import { useScrambleTracker } from '../hooks/useScrambleTracker'
import type { TrackingState } from '../hooks/useScrambleTracker'
import { useTimer } from '../hooks/useTimer'
import { useSolveHistory } from '../hooks/useSolveHistory'
import type { CloudConfig } from '../hooks/useSolveHistory'
import { useMethod } from '../hooks/useMethod'
import { MethodSelector } from './MethodSelector'
import { CubeCanvas } from './CubeCanvas'
import { ScrambleDisplay } from './ScrambleDisplay'
import { TimerDisplay } from './TimerDisplay'
import { PhaseBar } from './PhaseBar'
import { SolveHistorySidebar } from './SolveHistorySidebar'
import { SolveDetailModal } from './SolveDetailModal'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import type { Quaternion, Move, Face } from '../types/cube'
import { SOLVED_FACELETS } from '../types/cube'
import { MouseDriver } from '../drivers/MouseDriver'

interface Props {
  driver: MutableRefObject<CubeDriver | null>
  status: ConnectionStatus
  facelets: string
  quaternion: Quaternion
  onConnect: () => void
  onDisconnect: () => void
  onResetGyro: () => void
  onResetState: () => void
  isSolvingRef: MutableRefObject<boolean>
  gestureResetRef: MutableRefObject<() => void>
  driverVersion?: number
  driverType?: 'cube' | 'mouse'
  interactive?: boolean
  onCubeMove?: (face: Face, direction: 'CW' | 'CCW') => void
  cloudConfig?: CloudConfig
}

export function TimerScreen({
  driver,
  facelets,
  quaternion,
  onResetGyro,
  onResetState,
  isSolvingRef,
  gestureResetRef,
  driverVersion = 0,
  driverType,
  interactive,
  onCubeMove,
  cloudConfig,
}: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const resetOrientationRef = useRef<(() => void) | null>(null)
  const { solves, addSolve, deleteSolve, nextSolveIds, cloudLoading } = useSolveHistory(cloudConfig)

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => rendererRef.current?.animateMove(m.face, m.direction, 150)
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, driverVersion])

  const { scramble, steps, regenerate, load: loadScramble } = useScramble()
  const [armed, setArmed] = useState(false)
  const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(() => {
    const m = window.location.hash.match(/^#solve-(-?\d+)$/)
    if (m) {
      const id = parseInt(m[1], 10)
      return solves.find((s) => s.id === id) ?? null
    }
    return null
  })
  const [regeneratePending, setRegeneratePending] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH)
    return saved ? parseInt(saved, 10) : 160
  })
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_WIDTH, String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    if (selectedSolve) {
      window.location.hash = `solve-${selectedSolve.id}`
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [selectedSolve])

  const tracker = useScrambleTracker(steps, driver, () => setArmed(true), driverVersion)

  // Track trackingState at each D move so the gesture check can look at the state
  // at the time each move was made, not just when the 4th move fires the gesture.
  const trackingStateRef = useRef<TrackingState>(tracker.trackingState)
  trackingStateRef.current = tracker.trackingState
  const dGestureStatesRef = useRef<TrackingState[]>([])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (move: Move) => {
      if (move.face === 'D') {
        dGestureStatesRef.current.push(trackingStateRef.current)
        if (dGestureStatesRef.current.length > 4) dGestureStatesRef.current.shift()
      } else {
        dGestureStatesRef.current = []
      }
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, driverVersion])

  const { method, setMethod } = useMethod()

  const { status, elapsedMs, phaseRecords, recordedMoves, quaternionSnapshots, reset: resetTimer } = useTimer(
    driver,
    method,
    armed,
    driverVersion,
  )

  isSolvingRef.current = status === 'solving'

  // Show last solve time while scrambling; reset to 0.0 when armed
  const lastSolveTimeRef = useRef(0)
  if (status === 'solved') lastSolveTimeRef.current = elapsedMs
  const displayedElapsedMs = status !== 'idle' ? elapsedMs : armed ? 0 : lastSolveTimeRef.current

  // Keep last solve's phase bar visible until next solve starts
  const lastPhaseRecordsRef = useRef(phaseRecords)
  if (status === 'solving') lastPhaseRecordsRef.current = []
  if (phaseRecords.length > 0) lastPhaseRecordsRef.current = phaseRecords
  const displayedPhaseRecords = phaseRecords.length > 0 ? phaseRecords : lastPhaseRecordsRef.current

  // Save solve when timer reaches solved
  const prevStatusRef = useRef(status)
  if (status === 'solved' && prevStatusRef.current !== 'solved') {
    const { id, seq } = nextSolveIds()
    addSolve({
      id,
      seq,
      scramble: scramble ?? '',
      timeMs: elapsedMs,
      moves: recordedMoves,
      phases: phaseRecords,
      quaternionSnapshots,
      date: Date.now(),
      driver: driverType,
      method: method.id,
    })
    // Generate next scramble after short delay
    setTimeout(() => {
      regenerate()
      setArmed(false)
      resetTimer()
    }, 1000)
  }
  prevStatusRef.current = status

  const handleRegenerate = useCallback(() => {
    if (facelets === SOLVED_FACELETS) {
      regenerate()
      tracker.reset()
      setArmed(false)
      resetTimer()
    } else {
      setRegeneratePending(true)
    }
  }, [facelets, regenerate, resetTimer, tracker])

  // In wrong mode, if the cube is solved the user has undone everything — fresh start
  useEffect(() => {
    if (tracker.trackingState === 'wrong' && facelets === SOLVED_FACELETS) {
      regenerate()
      tracker.reset()
      setArmed(false)
      resetTimer()
      setRegeneratePending(false)
    }
  }, [facelets]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply pending regenerate as soon as the cube reaches solved state
  useEffect(() => {
    if (regeneratePending && facelets === SOLVED_FACELETS && status === 'idle') {
      regenerate()
      tracker.reset()
      setArmed(false)
      resetTimer()
      setRegeneratePending(false)
    }
  }, [facelets, regeneratePending, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetCube = () => {
    onResetState()
    tracker.reset()
    setArmed(false)
    resetTimer()
    regenerate()
  }
  gestureResetRef.current = () => {
    const states = dGestureStatesRef.current
    const startedBlocked = states.some(s => s === 'scrambling' || s === 'warning')
    dGestureStatesRef.current = []
    if (startedBlocked) return
    handleResetCube()
  }

  const handleAutoScramble = useCallback(() => {
    onResetState()
    tracker.reset()
    setArmed(false)
    resetTimer()
    rendererRef.current?.animateOrbitToDefaultView()
    const d = driver.current as MouseDriver
    let delay = 50
    for (const step of steps) {
      setTimeout(() => d.sendMove(step.face, step.direction), delay)
      delay += 200
      if (step.double) {
        setTimeout(() => d.sendMove(step.face, step.direction), delay)
        delay += 200
      }
    }
  }, [driver, steps, onResetState, tracker, resetTimer])

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <SolveHistorySidebar
        solves={solves}
        onSelectSolve={setSelectedSolve}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        cloudLoading={cloudLoading}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="timer-center" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 720,
          alignSelf: 'center',
          transform: `translateX(${-sidebarWidth / 2}px)`,
          padding: '8px 16px',
        }}>
          <div style={{ alignSelf: 'flex-end' }}>
            <button
              className="solves-btn-mobile"
              onClick={() => setShowHistory(true)}
              style={{ padding: '6px 14px', marginBottom: 4 }}
            >
              Solves
            </button>
          </div>

          <ScrambleDisplay
            scramble={scramble}
            steps={steps}
            stepStates={tracker.stepStates}
            trackingState={tracker.trackingState}
            wrongSegments={tracker.wrongSegments}
            regeneratePending={regeneratePending}
            onRegenerate={handleRegenerate}
            onResetCube={handleResetCube}
            onResetGyro={() => { onResetGyro(); resetOrientationRef.current?.() }}
            onAutoScramble={interactive ? handleAutoScramble : undefined}
          />

          <TimerDisplay
            elapsedMs={displayedElapsedMs}
            status={status}
            armed={armed}
          />

          <CubeCanvas
            facelets={facelets}
            quaternion={quaternion}
            onRendererReady={(r) => { rendererRef.current = r }}
            onResetOrientation={(fn) => { resetOrientationRef.current = fn }}
            onOrbit={(q) => { driver.current?.emit('gyro', q) }}
            interactive={interactive}
            onMove={onCubeMove}
          />

          <MethodSelector
            method={method}
            onChange={(m) => { setMethod(m); setArmed(false); resetTimer() }}
            disabled={status === 'solving'}
          />

          <PhaseBar phaseRecords={displayedPhaseRecords} method={method} />
        </div>
      </div>

      {showHistory && (
        <SolveHistorySidebar
          solves={solves}
          onSelectSolve={(s) => setSelectedSolve(s)}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onClose={() => setShowHistory(false)}
          cloudLoading={cloudLoading}
        />
      )}

      {selectedSolve && (
        <SolveDetailModal
          solve={selectedSolve}
          onClose={() => setSelectedSolve(null)}
          onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
          onUseScramble={(s) => { loadScramble(s); setSelectedSolve(null) }}
        />
      )}
    </div>
  )
}
