import { useRef, useState } from 'react'
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
import type { Quaternion } from '../types/cube'

interface Props {
  driver: MutableRefObject<CubeDriver | null>
  status: ConnectionStatus
  facelets: string
  quaternion: Quaternion
  onConnect: () => void
  onDisconnect: () => void
  onResetGyro: () => void
  onResetState: () => void
}

export function TimerScreen({
  driver,
  facelets,
  quaternion,
  onResetGyro,
  onResetState,
}: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const { scramble, steps, regenerate } = useScramble()
  const [armed, setArmed] = useState(false)
  const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(null)
  const idCounterRef = useRef(1)

  const tracker = useScrambleTracker(steps, driver, () => setArmed(true))

  const { status, elapsedMs, phaseRecords, recordedMoves, reset: resetTimer } = useTimer(
    driver,
    CFOP,
    armed,
  )

  const { solves, addSolve, deleteSolve, stats } = useSolveHistory()

  // Keep last solve's phase bar visible until next solve starts
  const lastPhaseRecordsRef = useRef(phaseRecords)
  if (status === 'solving') lastPhaseRecordsRef.current = []
  if (phaseRecords.length > 0) lastPhaseRecordsRef.current = phaseRecords
  const displayedPhaseRecords = phaseRecords.length > 0 ? phaseRecords : lastPhaseRecordsRef.current

  // Save solve when timer reaches solved
  const prevStatusRef = useRef(status)
  if (status === 'solved' && prevStatusRef.current !== 'solved') {
    const id = idCounterRef.current++
    addSolve({
      id,
      scramble: scramble ?? '',
      timeMs: elapsedMs,
      moves: recordedMoves,
      phases: phaseRecords,
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

  const handleResetCube = () => {
    onResetState()
    tracker.reset()
    setArmed(false)
    resetTimer()
    regenerate()
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <SolveHistorySidebar
        solves={solves}
        stats={stats}
        onSelectSolve={setSelectedSolve}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 16px' }}>
        <ScrambleDisplay
          scramble={scramble}
          steps={steps}
          stepStates={tracker.stepStates}
          trackingState={tracker.trackingState}
          wrongMove={tracker.wrongMove}
          onResetCube={handleResetCube}
          onResetGyro={onResetGyro}
        />

        <TimerDisplay
          elapsedMs={elapsedMs}
          status={status}
          armed={armed}
        />

        <CubeCanvas
          facelets={facelets}
          quaternion={quaternion}
          onRendererReady={(r) => { rendererRef.current = r }}
        />

        <PhaseBar phaseRecords={displayedPhaseRecords} method={CFOP} />
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
