import { useRef, useState, useEffect, useCallback } from 'react'
import { useCubeDriverEvent } from './hooks/useCubeDriverEvent'
import { STORAGE_KEYS } from './utils/storageKeys'
import { useCubeDriver } from './hooks/useCubeDriver'
import { useCubeState } from './hooks/useCubeState'
import { useGyro } from './hooks/useGyro'
import { useGestureDetector } from './hooks/useGestureDetector'
import { useSolveRecorder } from './hooks/useSolveRecorder'
import { ConnectionBar } from './components/ConnectionBar'
import { ControlBar } from './components/ControlBar'
import { CubeCanvas } from './components/CubeCanvas'
import { OrientationConfig } from './components/OrientationConfig'
import { MoveHistory } from './components/MoveHistory'
import { FaceletDebug } from './components/FaceletDebug'
import { TimerScreen } from './components/TimerScreen'
import { AnalyticsBanner } from './components/AnalyticsBanner'
import type { CubeRenderer } from './rendering/CubeRenderer'
import type { PositionMove, Face, RotationFace, Direction } from './types/cube'
import { MouseDriver } from './drivers/MouseDriver'
import { useCloudSync } from './hooks/useCloudSync'
import { logCubeConnected, logCubeFirstMove } from './services/analytics'
import { renumberSolvesInFirestore, recalibrateSolvesInFirestore, loadSolvesFromFirestore, updateSolveInFirestore, deleteSolveFromFirestore, migrateSolvesToV2InFirestore, loadNextSeqFromFirestore, bulkUpdateSolvesInFirestore } from './services/firestoreSolves'
import { recalibrateSolveTimes } from './utils/recalibrate'
import { loadFromStorage, saveToStorage } from './utils/storage'
import { detectMethodMismatches } from './utils/detectMethod'
import type { MethodMismatch } from './utils/detectMethod'
import { SolveDetailModal } from './components/SolveDetailModal'
import { AcubemyImportModal } from './components/AcubemyImportModal'
import { RecomputePhasesPanel } from './components/RecomputePhasesPanel'
import type { RecomputeChange } from './utils/recomputeAllPhases'
import type { SolveRecord } from './types/solve'
import { useHashRouter } from './hooks/useHashRouter'
import { solveStore } from './stores/solveStore'

export default function App() {
  const { driver, connect, disconnect, status, driverType, switchDriver, driverVersion } = useCubeDriver()
  const { facelets, isSolved, isSolvedRef, resetState, resetCenterPositions, handleMove } = useCubeState(driver, driverVersion)
  const { quaternion, config, resetGyro, resetSensorOffset, saveOrientationConfig, sensorStateRef } = useGyro(driver, driverVersion)
  useSolveRecorder(driver, isSolved, driverVersion)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const isSolvingRef = useRef(false)
  // Combined reset: cube facelets + sensor offset (M-slice position tracking).
  const resetAll = useCallback(() => { resetState(); resetSensorOffset() }, [resetState, resetSensorOffset])
  // Reorient facelets to white-top/green-front + reset sensor FSM to match the new frame.
  const resetCenterTracking = useCallback(() => { const next = resetCenterPositions(); resetSensorOffset(); return next }, [resetCenterPositions, resetSensorOffset])
  const gestureResetRef = useRef<() => void>(resetAll)
  const [moves, setMoves] = useState<PositionMove[]>([])
  const { currentRoute, navigate } = useHashRouter()
  const [mode, setMode] = useState<'debug' | 'timer'>(
    () => window.location.hash === '#debug' ? 'debug' : 'timer'
  )
  useEffect(() => {
    setMode(currentRoute.type === 'debug' ? 'debug' : 'timer')
  }, [currentRoute])
  const [battery, setBattery] = useState<number | null>(null)
  const cloudSync = useCloudSync()
  const cloudConfig = { enabled: cloudSync.enabled, user: cloudSync.user, authLoading: cloudSync.authLoading }

  useEffect(() => {
    solveStore.configure(cloudConfig)
  }, [cloudConfig.enabled, cloudConfig.user?.uid])

  const prevStatusRef = useRef<string>('')
  useEffect(() => {
    if (status === 'connected' && prevStatusRef.current !== 'connected') {
      logCubeConnected()
    }
    prevStatusRef.current = status
  }, [status])

  const hasFiredFirstMoveRef = useRef(false)
  useCubeDriverEvent(driver, 'move', () => {
    if (hasFiredFirstMoveRef.current) return
    hasFiredFirstMoveRef.current = true
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const driverParam = driverType === 'cube' ? 'ble' : isTouch ? 'touch' : 'mouse'
    logCubeFirstMove(driverParam)
  }, driverVersion)

  const [renumbering, setRenumbering] = useState<'idle' | 'running' | 'done'>('idle')
  const [recalibrating, setRecalibrating] = useState<'idle' | 'done'>('idle')
  const [recalibratedCount, setRecalibratedCount] = useState(0)
  const [recalibratingCloud, setRecalibratingCloud] = useState<'idle' | 'running' | 'done'>('idle')
  const [recalibratedCloudCount, setRecalibratedCloudCount] = useState(0)
  const [migratingV2, setMigratingV2] = useState<'idle' | 'running' | 'done'>('idle')
  const [migrateV2Result, setMigrateV2Result] = useState<{ migrated: number; failed: number } | null>(null)
  const [methodMismatches, setMethodMismatches] = useState<MethodMismatch[] | null>(null)
  const [detectingMismatches, setDetectingMismatches] = useState(false)
  const [selectedDebugSolve, setSelectedDebugSolve] = useState<SolveRecord | null>(null)
  const [showAcubemyImport, setShowAcubemyImport] = useState(false)
  const [existingSolvesForImport, setExistingSolvesForImport] = useState<SolveRecord[] | null>(null)

  const handleDebugUpdate = async (updated: SolveRecord): Promise<void> => {
    if (cloudSync.enabled && cloudSync.user) {
      await updateSolveInFirestore(cloudSync.user.uid, updated)
    } else {
      const solves = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
      saveToStorage(STORAGE_KEYS.SOLVES, solves.map((s) => s.id === updated.id ? updated : s))
    }
    setSelectedDebugSolve(updated)
    // Re-check just this solve — remove from list if fixed, update in place if still mismatched
    setMethodMismatches((prev) => {
      if (!prev) return prev
      const recheck = detectMethodMismatches([updated])
      if (recheck.length === 0) return prev.filter((m) => m.solve.id !== updated.id)
      return prev.map((m) => m.solve.id === updated.id ? recheck[0] : m)
    })
  }

  const handleDebugDelete = (id: number): void => {
    if (cloudSync.enabled && cloudSync.user) {
      const solve = selectedDebugSolve
      if (solve) void deleteSolveFromFirestore(cloudSync.user.uid, solve)
    } else {
      const solves = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
      saveToStorage(STORAGE_KEYS.SOLVES, solves.filter((s) => s.id !== id))
    }
    setSelectedDebugSolve(null)
    setMethodMismatches((prev) => prev ? prev.filter((m) => m.solve.id !== id) : prev)
  }

  const handleAcubemyCommit = async (drafts: SolveRecord[]): Promise<void> => {
    const current = solveStore.getSnapshot().solves
    const useCloudNow = !!(cloudSync.enabled && cloudSync.user)
    const uid = cloudSync.user?.uid ?? null

    const usedDates = new Set(current.map(s => s.date))
    const maxSeqLocal = Math.max(0, ...current.map(s => s.seq ?? 0))
    const storedCounter = parseInt(localStorage.getItem(STORAGE_KEYS.NEXT_ID) ?? '1', 10) || 1
    const cloudCounter = useCloudNow && uid ? await loadNextSeqFromFirestore(uid) : 0
    let nextSeq = Math.max(maxSeqLocal + 1, storedCounter, cloudCounter)

    const prepared: SolveRecord[] = drafts.map(draft => {
      let date = draft.date
      while (usedDates.has(date)) date += 1
      usedDates.add(date)
      const id = useCloudNow ? date : nextSeq
      const record: SolveRecord = { ...draft, date, id, seq: nextSeq }
      nextSeq++
      return record
    })

    const { failed } = await solveStore.addMany(prepared)
    if (failed.length > 0) {
      throw new Error(`${failed.length} of ${prepared.length} failed to import`)
    }
  }

  const handleCubeMove = useCallback((face: Face, direction: 'CW' | 'CCW') => {
    const d = driver.current
    if (d instanceof MouseDriver) d.sendMove(face, direction)
  }, [driver])

  useCubeDriverEvent(driver, 'battery', (pct) => setBattery(pct), driverVersion)

  useEffect(() => {
    if (status === 'disconnected') setBattery(null)
  }, [status])

  useCubeDriverEvent(driver, 'move', (m) => setMoves((prev) => [...prev.slice(-100), m]), driverVersion)
  useCubeDriverEvent(driver, 'replacePreviousMove', (m) => setMoves((prev) => [...prev.slice(0, -1), m]), driverVersion)
  useCubeDriverEvent(driver, 'move', (m) => {
    // Skip animation for whole-cube rotations (x/y/z) — no single-layer animation applies
    if (m.face !== 'x' && m.face !== 'y' && m.face !== 'z') {
      rendererRef.current?.animateMove(m.face, m.direction, 150)
    }
  }, driverVersion)

  useGestureDetector(driver, { resetGyro, resetState: () => gestureResetRef.current() }, isSolvedRef, isSolvingRef, driverVersion)

  const isConnected = status === 'connected'

  return (
    <div style={mode === 'timer'
      ? { height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
      : { maxWidth: '600px', margin: '0 auto', minHeight: '100vh', paddingBottom: 60 }
    }>
      <ConnectionBar
        status={status}
        onConnect={connect}
        onDisconnect={disconnect}
        mode={mode}
        onToggleMode={() => setMode((m) => {
          const next = m === 'debug' ? 'timer' : 'debug'
          history.replaceState(null, '', next === 'debug'
            ? `${window.location.pathname}${window.location.search}#debug`
            : window.location.pathname + window.location.search)
          return next
        })}
        battery={battery}
        driverType={driverType}
        onSwitchDriver={switchDriver}
      />
      {mode === 'timer' ? (
        <TimerScreen
          driver={driver}
          status={status}
          facelets={facelets}
          quaternion={quaternion}
          onConnect={connect}
          onDisconnect={disconnect}
          onResetGyro={resetGyro}
          onResetState={resetAll}
          onResetCenters={resetCenterTracking}
          isSolvingRef={isSolvingRef}
          gestureResetRef={gestureResetRef}
          driverVersion={driverVersion}
          driverType={driverType}
          interactive={driverType === 'mouse'}
          onCubeMove={handleCubeMove}
          cloudConfig={cloudConfig}
          currentRoute={currentRoute}
          navigate={navigate}
        />
      ) : (
        <>
          <ControlBar onResetGyro={resetGyro} onResetState={resetAll} onResetCenters={resetCenterTracking} disabled={!isConnected} />
          <div style={{ fontFamily: 'monospace', fontSize: 11, padding: '4px 16px', background: '#0a2040', color: '#7ec8e3', display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>FSM sensor state: <strong>{sensorStateRef.current}</strong> (0 = home)</span>
            <button
              onClick={() => { resetSensorOffset(); setMoves(m => [...m]) /* force re-render to refresh display */ }}
              style={{ padding: '2px 8px', color: '#7ec8e3', border: '1px solid #3a7a8a', background: 'transparent', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}
            >
              Reset FSM to 0
            </button>
          </div>
          <CubeCanvas
            facelets={facelets}
            quaternion={quaternion}
            onRendererReady={(r) => { rendererRef.current = r }}
            interactive={driverType === 'mouse'}
            onMove={handleCubeMove}
          />
          <OrientationConfig
            config={config}
            onSave={saveOrientationConfig}
            onUseCurrentOrientation={resetGyro}
            disabled={!isConnected}
          />
          <FaceletDebug facelets={facelets} />
          <MoveHistory moves={moves} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['x', 'y', 'z'] as RotationFace[]).flatMap((face) =>
                (['CW', 'CCW'] as Direction[]).map((dir) => {
                  const label = `${face}${dir === 'CCW' ? "'" : ''}`
                  const emitMove = () => {
                    const move: PositionMove = { face, direction: dir, cubeTimestamp: Date.now(), serial: 0 }
                    handleMove(move)
                    setMoves((prev) => [...prev.slice(-100), move])
                  }
                  return (
                    <button key={label} onClick={emitMove}
                      style={{ padding: '3px 8px', color: '#7ec8e3', border: '1px solid #3a7a8a', background: 'transparent', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                    >
                      {label}
                    </button>
                  )
                })
              )}
            </div>
            <button
              onClick={() => setMoves([])}
              style={{ padding: '3px 10px', color: '#aaa', border: '1px solid #555', background: 'transparent', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
            >
              Clear
            </button>
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 11,
            background: '#111',
            color: '#ccc',
            padding: '12px 16px',
            borderRadius: 6,
            marginTop: 8,
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#aaa' }}>Cloud Sync (Firebase)</div>

            {cloudSync.authLoading ? (
              <div style={{ color: '#666' }}>Loading auth...</div>
            ) : cloudSync.user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: '#4c4' }}>Signed in as {cloudSync.user.email}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cloudSync.enabled}
                      onChange={(e) => e.target.checked ? cloudSync.enable() : cloudSync.disable()}
                    />
                    Enable cloud sync
                  </label>
                </div>
                <button
                  onClick={cloudSync.signOut}
                  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: 'pointer', background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: 3, fontSize: 11 }}
                >
                  Sign out
                </button>
                <button
                  disabled={renumbering !== 'idle'}
                  onClick={async () => {
                    if (!cloudSync.user) return
                    if (!confirm('Renumber all cloud solves 1..n by date? This cannot be undone.')) return
                    setRenumbering('running')
                    const nextSeq = await renumberSolvesInFirestore(cloudSync.user.uid)
                    localStorage.setItem(STORAGE_KEYS.NEXT_ID, String(nextSeq))
                    setRenumbering('done')
                    setTimeout(() => window.location.reload(), 1000)
                  }}
                  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: renumbering !== 'idle' ? 'default' : 'pointer', background: '#222', color: renumbering === 'done' ? '#4c4' : '#e8a020', border: `1px solid ${renumbering === 'done' ? '#4c4' : '#e8a020'}`, borderRadius: 3, fontSize: 11 }}
                >
                  {renumbering === 'running' ? 'Renumbering...' : renumbering === 'done' ? 'Done! Reloading...' : 'Renumber solves (fix seq)'}
                </button>
                <button
                  disabled={recalibratingCloud !== 'idle'}
                  onClick={async () => {
                    if (!cloudSync.user) return
                    setRecalibratingCloud('running')
                    const count = await recalibrateSolvesInFirestore(cloudSync.user.uid)
                    setRecalibratedCloudCount(count)
                    setRecalibratingCloud('done')
                    setTimeout(() => setRecalibratingCloud('idle'), 3000)
                  }}
                  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: recalibratingCloud !== 'idle' ? 'default' : 'pointer', background: '#222', color: recalibratingCloud === 'done' ? '#4c4' : '#e8a020', border: `1px solid ${recalibratingCloud === 'done' ? '#4c4' : '#e8a020'}`, borderRadius: 3, fontSize: 11 }}
                >
                  {recalibratingCloud === 'running' ? 'Recalibrating...' : recalibratingCloud === 'done' ? `Done — ${recalibratedCloudCount} solve${recalibratedCloudCount !== 1 ? 's' : ''} updated` : 'Recalibrate solve times (hw clock)'}
                </button>
                <button
                  disabled={migratingV2 !== 'idle'}
                  onClick={async () => {
                    if (!cloudSync.user) return
                    const pending = (await loadSolvesFromFirestore(cloudSync.user.uid)).filter(s => (s.schemaVersion ?? 1) < 2).length
                    if (pending === 0) {
                      setMigrateV2Result({ migrated: 0, failed: 0 })
                      setMigratingV2('done')
                      setTimeout(() => { setMigratingV2('idle'); setMigrateV2Result(null) }, 3000)
                      return
                    }
                    if (!confirm(`Migrate ${pending} solve${pending !== 1 ? 's' : ''} to v2 (correct M/E/S face labels)?`)) return
                    setMigratingV2('running')
                    const result = await migrateSolvesToV2InFirestore(cloudSync.user.uid)
                    setMigrateV2Result(result)
                    setMigratingV2('done')
                    setTimeout(() => { setMigratingV2('idle'); setMigrateV2Result(null) }, 5000)
                  }}
                  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: migratingV2 !== 'idle' ? 'default' : 'pointer', background: '#222', color: migratingV2 === 'done' ? '#4c4' : '#e8a020', border: `1px solid ${migratingV2 === 'done' ? '#4c4' : '#e8a020'}`, borderRadius: 3, fontSize: 11 }}
                >
                  {migratingV2 === 'running'
                    ? 'Migrating...'
                    : migratingV2 === 'done' && migrateV2Result
                      ? `Done — ${migrateV2Result.migrated} migrated${migrateV2Result.failed > 0 ? `, ${migrateV2Result.failed} failed` : ''}`
                      : 'Migrate solves to v2 (fix M/E/S labels)'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: '#888' }}>Not signed in</div>
                <button
                  onClick={cloudSync.signIn}
                  style={{ alignSelf: 'flex-start', padding: '3px 10px', cursor: 'pointer', background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: 3, fontSize: 11 }}
                >
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
          <div style={{ padding: '12px 0', textAlign: 'center', display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { localStorage.clear(); window.location.reload() }}
              style={{ padding: '6px 14px', color: '#e74c3c', border: '1px solid #e74c3c', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}
            >
              Clear localStorage
            </button>
            <button
              onClick={() => { localStorage.removeItem(STORAGE_KEYS.DISMISSED_EXAMPLES); window.location.reload() }}
              style={{ padding: '6px 14px', color: '#3498db', border: '1px solid #3498db', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}
            >
              Restore example solves
            </button>
            <button
              disabled={recalibrating !== 'idle'}
              onClick={() => {
                const solves = loadFromStorage<import('./types/solve').SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
                const recalibrated = recalibrateSolveTimes(solves)
                const count = recalibrated.filter((s, i) => s.timeMs !== solves[i].timeMs).length
                saveToStorage(STORAGE_KEYS.SOLVES, recalibrated)
                setRecalibratedCount(count)
                setRecalibrating('done')
                setTimeout(() => setRecalibrating('idle'), 3000)
              }}
              style={{ padding: '6px 14px', color: recalibrating === 'done' ? '#4c4' : '#e8a020', border: `1px solid ${recalibrating === 'done' ? '#4c4' : '#e8a020'}`, background: 'transparent', borderRadius: 4, cursor: recalibrating !== 'idle' ? 'default' : 'pointer' }}
            >
              {recalibrating === 'done' ? `Done — ${recalibratedCount} solve${recalibratedCount !== 1 ? 's' : ''} updated` : 'Recalibrate solve times (hw clock)'}
            </button>
            <button
              disabled={detectingMismatches}
              onClick={async () => {
                if (cloudSync.enabled && cloudSync.user) {
                  setDetectingMismatches(true)
                  const solves = await loadSolvesFromFirestore(cloudSync.user.uid)
                  setMethodMismatches(detectMethodMismatches(solves))
                  setDetectingMismatches(false)
                } else {
                  const solves = loadFromStorage<import('./types/solve').SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
                  setMethodMismatches(detectMethodMismatches(solves))
                }
              }}
              style={{ padding: '6px 14px', color: '#3498db', border: '1px solid #3498db', background: 'transparent', borderRadius: 4, cursor: detectingMismatches ? 'default' : 'pointer' }}
            >
              {detectingMismatches ? 'Detecting...' : `Detect method mismatches (${cloudSync.enabled && cloudSync.user ? 'Firestore' : 'localStorage'})`}
            </button>
            <button
              onClick={async () => {
                if (cloudSync.enabled && cloudSync.user) {
                  setExistingSolvesForImport(await loadSolvesFromFirestore(cloudSync.user.uid))
                } else {
                  setExistingSolvesForImport(loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, []))
                }
                setShowAcubemyImport(true)
              }}
              style={{ padding: '6px 14px', color: '#9b59b6', border: '1px solid #9b59b6', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}
            >
              Import from acubemy
            </button>
          </div>
          <RecomputePhasesPanel
            targetLabel={cloudSync.enabled && cloudSync.user ? 'Firestore' : 'localStorage'}
            loadSolves={async () => {
              if (cloudSync.enabled && cloudSync.user) {
                return await loadSolvesFromFirestore(cloudSync.user.uid)
              }
              return loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
            }}
            commitChanges={async (changes: RecomputeChange[], onProgress) => {
              if (cloudSync.enabled && cloudSync.user) {
                const updated = changes.map((c) => ({ ...c.solve, phases: c.newPhases }))
                await bulkUpdateSolvesInFirestore(cloudSync.user.uid, updated, onProgress)
              } else {
                const solves = loadFromStorage<SolveRecord[]>(STORAGE_KEYS.SOLVES, [])
                const byId = new Map(changes.map((c) => [c.solve.id, c.newPhases]))
                const updated = solves.map((s) => byId.has(s.id) ? { ...s, phases: byId.get(s.id)! } : s)
                saveToStorage(STORAGE_KEYS.SOLVES, updated)
                onProgress(1, 1)
              }
            }}
            onSolveClick={setSelectedDebugSolve}
          />
          {methodMismatches !== null && (
            <div style={{ fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc', padding: '12px 16px', borderRadius: 6, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 'bold', color: '#aaa' }}>
                  Method Mismatches
                </span>
                <span style={{ color: methodMismatches.length === 0 ? '#4c4' : '#e8a020' }}>
                  {methodMismatches.length === 0 ? '✓ No mismatches found' : `${methodMismatches.length} flagged`}
                </span>
                <button onClick={() => setMethodMismatches(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
              {methodMismatches.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#666', textAlign: 'left' }}>
                      <th style={{ padding: '2px 8px 4px 0' }}>Solve</th>
                      <th style={{ padding: '2px 8px 4px 0' }}>Stored</th>
                      <th style={{ padding: '2px 8px 4px 0' }}>Suggested</th>
                      <th style={{ padding: '2px 8px 4px 0', textAlign: 'right' }}>M</th>
                      <th style={{ padding: '2px 8px 4px 0', textAlign: 'right' }}>Cross</th>
                      <th style={{ padding: '2px 0 4px 0', textAlign: 'right' }}>FB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodMismatches.map(({ solve, storedMethod, suggestedMethod, mMoves, cfopCrossTurns, rouxFBTurns }) => (
                      <tr key={solve.id} style={{ borderTop: '1px solid #222' }}>
                        <td style={{ padding: '3px 8px 3px 0' }}>
                          <button
                            onClick={() => setSelectedDebugSolve(solve)}
                            style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: 'monospace', textDecoration: 'underline' }}
                          >
                            #{solve.id}
                          </button>
                        </td>
                        <td style={{ padding: '3px 8px 3px 0', color: '#e74c3c' }}>{storedMethod}</td>
                        <td style={{ padding: '3px 8px 3px 0', color: '#4c4' }}>{suggestedMethod}</td>
                        <td style={{ padding: '3px 8px 3px 0', textAlign: 'right', color: mMoves >= 8 ? '#e8a020' : '#ccc' }}>{mMoves}</td>
                        <td style={{ padding: '3px 8px 3px 0', textAlign: 'right', color: cfopCrossTurns > 20 ? '#e74c3c' : '#ccc' }}>{cfopCrossTurns}</td>
                        <td style={{ padding: '3px 0 3px 0', textAlign: 'right', color: rouxFBTurns > 20 ? '#e74c3c' : '#ccc' }}>{rouxFBTurns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {selectedDebugSolve && (
            <SolveDetailModal
              solve={selectedDebugSolve}
              onClose={() => setSelectedDebugSolve(null)}
              onDelete={handleDebugDelete}
              onUpdate={handleDebugUpdate}
            />
          )}
          {showAcubemyImport && existingSolvesForImport !== null && (
            <AcubemyImportModal
              open={true}
              onClose={() => { setShowAcubemyImport(false); setExistingSolvesForImport(null) }}
              existingSolves={existingSolvesForImport}
              cloudConfig={cloudConfig}
              onCommit={handleAcubemyCommit}
            />
          )}
        </>
      )}
      <AnalyticsBanner />
    </div>
  )
}
