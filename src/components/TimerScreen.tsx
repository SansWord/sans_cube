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
import { useSolveStore } from '../hooks/useSolveStore'
import type { CloudConfig } from '../stores/solveStore'
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
import { shareSolve, unshareSolve, isSharedSolveOwner } from '../services/firestoreSharing'
import { logSolveRecorded } from '../services/analytics'
import { useSharedSolve } from '../hooks/useSharedSolve'
import type { Route, TrendsHashParams } from '../hooks/useHashRouter'
import { parseHash, decideSelectedSolveUrlAction, decideSharedSolveUrlAction } from '../hooks/useHashRouter'

interface Props {
  driver: MutableRefObject<CubeDriver | null>
  status: ConnectionStatus
  facelets: string
  quaternion: Quaternion
  onConnect: () => void
  onDisconnect: () => void
  onResetGyro: () => void
  onResetState: () => void
  onResetCenters?: () => string | undefined
  isSolvingRef: MutableRefObject<boolean>
  gestureResetRef: MutableRefObject<() => void>
  driverVersion?: number
  driverType?: 'cube' | 'mouse'
  interactive?: boolean
  onCubeMove?: (face: Face, direction: 'CW' | 'CCW') => void
  cloudConfig?: CloudConfig
  currentRoute: Route
  navigate: (route: Route) => void
}


export function TimerScreen({
  driver,
  facelets,
  quaternion,
  onResetGyro,
  onResetState,
  onResetCenters,
  isSolvingRef,
  gestureResetRef,
  driverVersion = 0,
  driverType,
  interactive,
  onCubeMove,
  cloudConfig,
  currentRoute,
  navigate,
}: Props) {
  const rendererRef = useRef<CubeRenderer | null>(null)
  const resetOrientationRef = useRef<(() => void) | null>(null)
  const { solves, addSolve, deleteSolve, updateSolve, nextSolveIds, cloudLoading } = useSolveStore()

  useCubeDriverEvent(driver, 'move', (m) => rendererRef.current?.animateMove(m.face, m.direction, 150), driverVersion)

  const { scramble, steps, regenerate, load: loadScramble } = useScramble()
  const [armed, setArmed] = useState(false)
  const [selectedSolve, setSelectedSolve] = useState<SolveRecord | null>(null)
  const solvesRef = useRef(solves)
  solvesRef.current = solves
  const [regeneratePending, setRegeneratePending] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH)
    const parsed = saved ? parseInt(saved, 10) : 200
    return Math.max(220, parsed)
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
  const defaultTrendsParams: TrendsHashParams = {
    tab: 'total', windowSize: null, grouped: true,
    totalToggle: { exec: false, recog: false, total: true },
    phaseToggle: { exec: false, recog: false, total: true },
    method: null, driver: null,
  }
  const trendParams = currentRoute.type === 'trends' ? currentRoute.params : defaultTrendsParams
  const { sharedSolve, sharedSolveLoading, sharedSolveNotFound, clearSharedSolve } = useSharedSolve(currentRoute)
  const [sharedSolveIsOwned, setSharedSolveIsOwned] = useState(false)
  const urlResolvedRef = useRef(false)
  const prevSelectedSolveRef = useRef<SolveRecord | null>(null)
  const prevSharedSolveRef = useRef<SolveRecord | null>(null)
  const savedTrendsHashRef = useRef('')
  const showTrendsRef = useRef(showTrends)
  showTrendsRef.current = showTrends

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_WIDTH, String(sidebarWidth))
  }, [sidebarWidth])

  // Resolve URL route once cloud data is ready
  useEffect(() => {
    if (cloudLoading || urlResolvedRef.current) return
    urlResolvedRef.current = true
    if (currentRoute.type === 'trends') {
      setShowTrends(true)
      const { method, driver } = currentRoute.params
      if (method || driver) {
        updateSolveFilter(f => ({
          ...f,
          ...(method ? { method } : {}),
          ...(driver ? { driver } : {}),
        }))
      }
    } else if (currentRoute.type === 'solve') {
      const solve = solves.find(s => s.id === currentRoute.id)
      if (solve) setSelectedSolve(solve)
    }
    // #shared handled by useSharedSolve independently (no cloudLoading dependency)
  }, [cloudLoading, solves, currentRoute])

  // React to currentRoute changes after boot.
  // solvesRef (not solves) is intentional: re-running on every solves update would
  // re-open the modal after the user closes it whenever Firestore syncs.
  useEffect(() => {
    if (!urlResolvedRef.current) return
    if (currentRoute.type === 'trends') {
      setSelectedSolve(null)
      setShowTrends(true)
      const { method, driver } = currentRoute.params
      if (method || driver) {
        updateSolveFilter(f => ({
          ...f,
          ...(method ? { method } : {}),
          ...(driver ? { driver } : {}),
        }))
      }
    } else if (currentRoute.type === 'solve') {
      const solve = solvesRef.current.find(s => s.id === currentRoute.id)
      if (solve) { setShowTrends(false); setSelectedSolve(solve) }
    } else if (currentRoute.type === 'none') {
      setSelectedSolve(null)
      setShowTrends(false)
    }
    // 'debug' and 'shared' handled by App.tsx and useSharedSolve respectively
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoute])

  // Write URL for selectedSolve.
  // showTrends is intentionally read via ref so this effect doesn't re-fire when
  // trends opens/closes — that would incorrectly call navigate({type:'none'}) while
  // selectedSolve is null, blinking the trends modal shut.
  useEffect(() => {
    if (!urlResolvedRef.current) return
    if (!!sharedSolve || sharedSolveLoading) return
    const prev = prevSelectedSolveRef.current
    prevSelectedSolveRef.current = selectedSolve
    const action = decideSelectedSolveUrlAction(
      prev ? prev.id : null,
      selectedSolve ? selectedSolve.id : null,
      savedTrendsHashRef.current,
      showTrendsRef.current,
    )
    const base = window.location.pathname + window.location.search
    if (action.kind === 'noop') return
    if (action.kind === 'open-push') {
      if (action.saveTrendsHash) savedTrendsHashRef.current = window.location.hash
      history.pushState(null, '', `${base}#solve-${action.id}`)
      navigate({ type: 'solve', id: action.id })
    } else if (action.kind === 'open-replace') {
      history.replaceState(null, '', `${base}#solve-${action.id}`)
      navigate({ type: 'solve', id: action.id })
    } else if (action.kind === 'restore-trends') {
      savedTrendsHashRef.current = ''
      history.replaceState(null, '', base + action.hash)
      navigate(parseHash(action.hash))
    } else {
      history.replaceState(null, '', base)
      navigate({ type: 'none' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSolve, sharedSolve, sharedSolveLoading, navigate])

  // Write URL for sharedSolve.
  // No urlResolvedRef guard here: clearing the URL on close must work even if cloud
  // loading hasn't finished. The `prev` check prevents clearing on initial mount.
  useEffect(() => {
    if (showTrends) return
    const prev = prevSharedSolveRef.current
    prevSharedSolveRef.current = sharedSolve
    const action = decideSharedSolveUrlAction(
      prev?.shareId ?? null,
      sharedSolve?.shareId ?? null,
      window.location.hash,
      sharedSolveLoading,
    )
    if (action.kind === 'noop') return
    const base = window.location.pathname + window.location.search
    if (action.kind === 'clear') {
      history.replaceState(null, '', base)
      navigate({ type: 'none' })
      return
    }
    // open-push / open-replace — defer until the boot flow has resolved so we
    // don't race the route resolver.
    if (!urlResolvedRef.current) return
    const url = `${base}#shared-${action.shareId}`
    if (action.kind === 'open-push') {
      history.pushState(null, '', url)
    } else {
      history.replaceState(null, '', url)
    }
    navigate({ type: 'shared', shareId: action.shareId })
  }, [sharedSolve, sharedSolveLoading, showTrends, navigate])

  // Close other modals when a shared solve is loaded via hashchange
  useEffect(() => {
    if (sharedSolve) { setSelectedSolve(null); setShowTrends(false) }
  }, [sharedSolve])

  // Check if current user owns the shared solve via their registry doc
  useEffect(() => {
    const uid = cloudConfig?.user?.uid
    const shareId = sharedSolve?.shareId
    if (!sharedSolve || !uid || !shareId) { setSharedSolveIsOwned(false); return }
    void isSharedSolveOwner(uid, shareId).then(setSharedSolveIsOwned)
  }, [sharedSolve, cloudConfig?.user?.uid])

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

  const { status, elapsedMs, phaseRecords, recordedMoves, quaternionSnapshots, reset: resetTimer, syncFacelets: timerSyncFacelets } = useTimer(
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

  // Reset center tracking when the scramble completes (armed), before the solve starts.
  // Firing here (not at 'solving') avoids a race: the 'solving' transition is triggered
  // by the first solve move, so a BLE R+L pair for an M move could be in-flight when
  // syncFacelets fires. Armed fires when the scramble finishes — well before the user
  // picks up the cube to solve.
  // The reoriented facelets are also forwarded to the timer so both the driver and the
  // timer agree on the geometric frame after any whole-cube reorientation.
  useEffect(() => {
    if (armed) {
      const reoriented = onResetCenters?.()
      if (reoriented) timerSyncFacelets(reoriented)
    }
  }, [armed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Also reset after the solve ends (reorient for the next scramble).
  useEffect(() => {
    if (status === 'solved') onResetCenters?.()
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'solved' && prevStatusRef.current !== 'solved') {
    const { id, seq } = nextSolveIds()
    addSolve({
      id,
      seq,
      schemaVersion: 2,
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
            onLoad={(s) => { loadScramble(s); tracker.reset(); setArmed(false); resetTimer() }}
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
            history.replaceState(null, '', window.location.pathname + window.location.search)
            navigate({ type: 'none' })
          }}
          detailOpen={!!selectedSolve || !!sharedSolve || sharedSolveLoading}
          initialParams={trendParams}
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
          onDelete={sharedSolveIsOwned ? (id) => { deleteSolve(id); clearSharedSolve() } : () => {}}
          onUpdate={sharedSolveIsOwned ? async (updated) => { await updateSolve(updated) } : async () => {}}
          onUnshare={sharedSolveIsOwned && cloudConfig?.user
            ? async (shareId) => { await unshareSolve(cloudConfig.user!.uid, shareId); clearSharedSolve() }
            : undefined
          }
          readOnly={!sharedSolveIsOwned}
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
        const label = currentRoute.type === 'trends' ? 'Syncing trends from cloud…'
          : currentRoute.type === 'solve' ? 'Syncing solve from cloud…'
          : currentRoute.type === 'shared' ? 'Loading shared solve…'
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
