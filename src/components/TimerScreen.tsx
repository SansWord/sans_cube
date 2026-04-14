import { useRef, useState, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { ConnectionStatus } from '../drivers/CubeDriver'
import { STORAGE_KEYS } from '../utils/storageKeys'
import type { SolveRecord, SolveFilter, MethodFilter, DriverFilter } from '../types/solve'
import { useCubeDriverEvent } from '../hooks/useCubeDriverEvent'
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
import { TrendsModal } from './TrendsModal'
import type { CubeRenderer } from '../rendering/CubeRenderer'
import type { Quaternion, Face } from '../types/cube'
import { SOLVED_FACELETS } from '../types/cube'
import { MouseDriver } from '../drivers/MouseDriver'
import { shareSolve, unshareSolve } from '../services/firestoreSharing'
import { logSolveRecorded } from '../services/analytics'
import { useSharedSolve } from '../hooks/useSharedSolve'

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

function parseTrendsFilterFromHash(hash: string): Partial<SolveFilter> | null {
  if (!hash.startsWith('#trends')) return null
  const search = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(search)
  const method = params.get('method')
  const driver = params.get('driver')
  if (!method && !driver) return null
  const result: Partial<SolveFilter> = {}
  if (method && ['all', 'cfop', 'roux'].includes(method)) result.method = method as MethodFilter
  if (driver && ['all', 'cube', 'mouse'].includes(driver)) result.driver = driver as DriverFilter
  return result
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
  const { solves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading } = useSolveHistory(cloudConfig)

  useCubeDriverEvent(driver, 'move', (m) => rendererRef.current?.animateMove(m.face, m.direction, 150), driverVersion)

  const { scramble, steps, regenerate, load: loadScramble } = useScramble()
  const [armed, setArmed] = useState(false)
  const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(null)
  const [regeneratePending, setRegeneratePending] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH)
    return saved ? parseInt(saved, 10) : 160
  })
  const [showHistory, setShowHistory] = useState(false)
  const [solveFilter, setSolveFilter] = useState<SolveFilter>(() => {
    const method = (localStorage.getItem(STORAGE_KEYS.METHOD_FILTER) ?? 'all') as MethodFilter
    const driver = (localStorage.getItem(STORAGE_KEYS.DRIVER_FILTER) ?? 'all') as DriverFilter
    return { method, driver }
  })

  function updateSolveFilter(updater: (f: SolveFilter) => SolveFilter) {
    setSolveFilter(prev => {
      const next = updater(prev)
      localStorage.setItem(STORAGE_KEYS.METHOD_FILTER, next.method)
      localStorage.setItem(STORAGE_KEYS.DRIVER_FILTER, next.driver)
      return next
    })
  }

  const [showTrends, setShowTrends] = useState(false)
  const { sharedSolve, sharedSolveLoading, sharedSolveNotFound, clearSharedSolve } = useSharedSolve()
  const urlResolvedRef = useRef(false)
  const initialHashRef = useRef(window.location.hash)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_WIDTH, String(sidebarWidth))
  }, [sidebarWidth])

  // Resolve URL hash once cloud data is ready (fixes cloud timing bug)
  useEffect(() => {
    if (cloudLoading || urlResolvedRef.current) return
    urlResolvedRef.current = true
    const hash = window.location.hash
    if (hash.startsWith('#trends')) {
      setShowTrends(true)
      const override = parseTrendsFilterFromHash(hash)
      if (override) updateSolveFilter(f => ({ ...f, ...override }))
    } else if (hash.startsWith('#solve-')) {
      const id = parseInt(hash.replace('#solve-', ''), 10)
      const solve = solves.find(s => s.id === id)
      if (solve) setSelectedSolve(solve)
    }
  }, [cloudLoading, solves])

  // Write URL hash for selectedSolve (only when TrendsModal is not open).
  // Uses replaceState (not window.location.hash=) to avoid firing a hashchange event.
  useEffect(() => {
    if (!urlResolvedRef.current) return  // don't clear hash before initial URL is resolved
    if (showTrends || !!sharedSolve || sharedSolveLoading) return
    if (selectedSolve) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#solve-${selectedSolve.id}`)
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [selectedSolve, showTrends, sharedSolve, sharedSolveLoading])

  // Respond to user-initiated hash changes (e.g. typing a URL in the address bar)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash.startsWith('#trends')) {
        setSelectedSolve(null)
        setShowTrends(true)
        const override = parseTrendsFilterFromHash(hash)
        if (override) updateSolveFilter(f => ({ ...f, ...override }))
      } else if (hash.startsWith('#solve-')) {
        const id = parseInt(hash.replace('#solve-', ''), 10)
        const solve = solves.find(s => s.id === id)
        if (solve) { setShowTrends(false); setSelectedSolve(solve) }
      } else {
        setSelectedSolve(null)
        setShowTrends(false)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [solves])

  // Close other modals when a shared solve is loaded via hashchange
  useEffect(() => {
    if (sharedSolve) { setSelectedSolve(null); setShowTrends(false) }
  }, [sharedSolve])

  const tracker = useScrambleTracker(steps, driver, () => setArmed(true), driverVersion)

  // Track trackingState at each D move so the gesture check can look at the state
  // at the time each move was made, not just when the 4th move fires the gesture.
  const trackingStateRef = useRef<TrackingState>(tracker.trackingState)
  trackingStateRef.current = tracker.trackingState
  const dGestureStatesRef = useRef<TrackingState[]>([])

  useCubeDriverEvent(driver, 'move', (move) => {
    if (move.face === 'D') {
      dGestureStatesRef.current.push(trackingStateRef.current)
      if (dGestureStatesRef.current.length > 4) dGestureStatesRef.current.shift()
    } else {
      dGestureStatesRef.current = []
    }
  }, driverVersion)

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
  const lastPhaseMethodRef = useRef(method)
  if (status === 'solving') lastPhaseRecordsRef.current = []
  if (phaseRecords.length > 0) {
    lastPhaseRecordsRef.current = phaseRecords
    lastPhaseMethodRef.current = method
  }
  const displayedPhaseRecords = phaseRecords.length > 0 ? phaseRecords : lastPhaseRecordsRef.current
  const displayedPhaseMethod = phaseRecords.length > 0 ? method : lastPhaseMethodRef.current

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
    logSolveRecorded(method.id)
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
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <SolveHistorySidebar
        solves={solves}
        onSelectSolve={setSelectedSolve}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        cloudLoading={cloudLoading}
        solveFilter={solveFilter}
        updateSolveFilter={updateSolveFilter}
        onOpenTrends={() => setShowTrends(true)}
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
            onChange={(m) => { setMethod(m); if (!armed) resetTimer() }}
            disabled={status === 'solving'}
          />

          <PhaseBar phaseRecords={displayedPhaseRecords} method={displayedPhaseMethod} />
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
          solveFilter={solveFilter}
          updateSolveFilter={updateSolveFilter}
          onOpenTrends={() => { setShowTrends(true); setShowHistory(false) }}
        />
      )}

      {showTrends && (
        <TrendsModal
          solves={solves}
          solveFilter={solveFilter}
          updateSolveFilter={updateSolveFilter}
          onSelectSolve={setSelectedSolve}
          onClose={() => {
            setShowTrends(false)
            setSelectedSolve(null)
          }}
          detailOpen={!!selectedSolve}
        />
      )}

      {selectedSolve && (
        <SolveDetailModal
          solve={selectedSolve}
          onClose={() => setSelectedSolve(null)}
          onDelete={(id) => { deleteSolve(id); setSelectedSolve(null) }}
          onUseScramble={(s) => { loadScramble(s); setSelectedSolve(null) }}
          onUpdate={async (updated) => { await updateSolve(updated) }}
          onShare={cloudConfig?.enabled && cloudConfig?.user
            ? async (solve) => shareSolve(cloudConfig.user!.uid, solve)
            : undefined
          }
          onUnshare={cloudConfig?.enabled && cloudConfig?.user
            ? async (shareId) => unshareSolve(cloudConfig.user!.uid, shareId)
            : undefined
          }
        />
      )}

      {sharedSolve && (
        <SolveDetailModal
          solve={sharedSolve}
          onClose={clearSharedSolve}
          onDelete={() => {}}
          onUpdate={async () => {}}
          readOnly
        />
      )}

      {/* Loading overlay for shared solve */}
      {sharedSolveLoading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'all',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#111', border: '1px solid #333', borderRadius: 8,
            padding: '10px 18px', color: '#888', fontSize: 13,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid #333', borderTopColor: '#888',
              animation: 'spin 0.8s linear infinite', flexShrink: 0,
            }} />
            Loading shared solve…
          </div>
        </div>
      )}

      {/* Not-found banner for shared solve */}
      {sharedSolveNotFound && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, background: '#1a1a2e', border: '1px solid #555',
          borderRadius: 8, padding: '10px 18px', color: '#aaa', fontSize: 13,
        }}>
          Solve not found or no longer shared.
        </div>
      )}

      {cloudLoading && !sharedSolveLoading && (() => {
        const h = initialHashRef.current
        const label = h.startsWith('#trends') ? 'Syncing trends from cloud…'
          : h.startsWith('#solve-') ? 'Syncing solve from cloud…'
          : h.startsWith('#shared-') ? 'Loading shared solve…'
          : null
        if (!label) return null
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'all',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#111', border: '1px solid #333', borderRadius: 8,
              padding: '10px 18px', color: '#888', fontSize: 13,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid #333', borderTopColor: '#888',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              {label}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
