import { useRef, useState, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { ConnectionStatus } from '../drivers/CubeDriver'
import type { SolveRecord } from '../types/solve'
import { useScramble } from '../hooks/useScramble'
import { useScrambleTracker } from '../hooks/useScrambleTracker'
import { useTimer } from '../hooks/useTimer'
import { useSolveHistory } from '../hooks/useSolveHistory'
import { CFOP } from '../methods/cfop'
import { CubeCanvas } from './CubeCanvas'
import { ScrambleDisplay } from './ScrambleDisplay'
import { TimerDisplay } from './TimerDisplay'
import { PhaseBar } from './PhaseBar'
import { SolveHistorySidebar } from './SolveHistorySidebar'
import { SolveDetailModal } from './SolveDetailModal'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import type { Quaternion, Move, Face } from '../types/cube'
import { SOLVED_FACELETS } from '../types/cube'

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
  interactive?: boolean
  onCubeMove?: (face: Face, direction: 'CW' | 'CCW') => void
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
  interactive,
  onCubeMove,
}: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const { solves, addSolve, deleteSolve, stats, nextId } = useSolveHistory()

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => rendererRef.current?.animateMove(m.face, m.direction, 150)
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, driverVersion])

  const { scramble, steps, regenerate } = useScramble()
  const [armed, setArmed] = useState(false)
  const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(() => {
    const m = window.location.hash.match(/^#solve-(\d+)$/)
    if (m) {
      const id = parseInt(m[1], 10)
      return solves.find((s) => s.id === id) ?? null
    }
    return null
  })
  const [regeneratePending, setRegeneratePending] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? parseInt(saved, 10) : 160
  })

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    if (selectedSolve) {
      window.location.hash = `solve-${selectedSolve.id}`
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [selectedSolve])

  const tracker = useScrambleTracker(steps, driver, () => setArmed(true), driverVersion)

  const { status, elapsedMs, phaseRecords, recordedMoves, quaternionSnapshots, reset: resetTimer } = useTimer(
    driver,
    CFOP,
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
    const id = nextId()
    addSolve({
      id,
      scramble: scramble ?? '',
      timeMs: elapsedMs,
      moves: recordedMoves,
      phases: phaseRecords,
      quaternionSnapshots,
      date: Date.now(),
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
  gestureResetRef.current = handleResetCube

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <SolveHistorySidebar
        solves={solves}
        stats={stats}
        onSelectSolve={setSelectedSolve}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 720,
          alignSelf: 'center',
          transform: `translateX(${-sidebarWidth / 2}px)`,
          padding: '8px 16px',
        }}>
          <ScrambleDisplay
            scramble={scramble}
            steps={steps}
            stepStates={tracker.stepStates}
            trackingState={tracker.trackingState}
            wrongSegments={tracker.wrongSegments}
            regeneratePending={regeneratePending}
            onRegenerate={handleRegenerate}
            onResetCube={handleResetCube}
            onResetGyro={onResetGyro}
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
            interactive={interactive}
            onMove={onCubeMove}
          />

          <PhaseBar phaseRecords={displayedPhaseRecords} method={CFOP} />
        </div>
      </div>

      {selectedSolve && (
        <SolveDetailModal
          solve={selectedSolve}
          onClose={() => setSelectedSolve(null)}
          onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
          onUseScramble={(_s) => {
            // Load this scramble into the tracker by regenerating with it
            // For now: close modal; full "use this scramble" feature requires useScramble to accept override
            setSelectedSolve(null)
          }}
        />
      )}
    </div>
  )
}
