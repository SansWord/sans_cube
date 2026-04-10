import { useRef, useState, useEffect, useCallback } from 'react'
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
import { SolveReplayer } from './components/SolveReplayer'
import { TimerScreen } from './components/TimerScreen'
import type { CubeRenderer } from './rendering/CubeRenderer'
import type { Move, Face } from './types/cube'
import { MouseDriver } from './drivers/MouseDriver'
import { useCloudSync } from './hooks/useCloudSync'
import { renumberSolvesInFirestore, recalibrateSolvesInFirestore } from './services/firestoreSolves'
import { recalibrateSolveTimes } from './utils/recalibrate'
import { loadFromStorage, saveToStorage } from './utils/storage'

export default function App() {
  const { driver, connect, disconnect, status, driverType, switchDriver, driverVersion } = useCubeDriver()
  const { facelets, isSolved, isSolvedRef, resetState } = useCubeState(driver, driverVersion)
  const { quaternion, config, resetGyro, saveOrientationConfig } = useGyro(driver, driverVersion)
  const { lastSession, clearSession } = useSolveRecorder(driver, isSolved, driverVersion)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const isSolvingRef = useRef(false)
  const gestureResetRef = useRef<() => void>(resetState)
  const [moves, setMoves] = useState<Move[]>([])
  const [mode, setMode] = useState<'debug' | 'timer'>('timer')
  const [battery, setBattery] = useState<number | null>(null)
  const cloudSync = useCloudSync()
  const cloudConfig = { enabled: cloudSync.enabled, user: cloudSync.user, authLoading: cloudSync.authLoading }
  const [renumbering, setRenumbering] = useState<'idle' | 'running' | 'done'>('idle')
  const [recalibrating, setRecalibrating] = useState<'idle' | 'done'>('idle')
  const [recalibratedCount, setRecalibratedCount] = useState(0)
  const [recalibratingCloud, setRecalibratingCloud] = useState<'idle' | 'running' | 'done'>('idle')
  const [recalibratedCloudCount, setRecalibratedCloudCount] = useState(0)

  const handleCubeMove = useCallback((face: Face, direction: 'CW' | 'CCW') => {
    const d = driver.current
    if (d instanceof MouseDriver) d.sendMove(face, direction)
  }, [driver])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onBattery = (pct: number) => setBattery(pct)
    d.on('battery', onBattery)
    return () => d.off('battery', onBattery)
  }, [driver, driverVersion])

  useEffect(() => {
    if (status === 'disconnected') setBattery(null)
  }, [status])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => setMoves((prev) => [...prev.slice(-100), m])
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, driverVersion])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => {
      rendererRef.current?.animateMove(m.face, m.direction, 150)
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, driverVersion])

  useGestureDetector(driver, { resetGyro, resetState: () => gestureResetRef.current() }, isSolvedRef, isSolvingRef, driverVersion)

  const isConnected = status === 'connected'

  return (
    <div style={mode === 'timer'
      ? { height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
      : { maxWidth: '600px', margin: '0 auto', minHeight: '100vh' }
    }>
      <ConnectionBar
        status={status}
        onConnect={connect}
        onDisconnect={disconnect}
        mode={mode}
        onToggleMode={() => setMode((m) => (m === 'debug' ? 'timer' : 'debug'))}
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
          onResetState={resetState}
          isSolvingRef={isSolvingRef}
          gestureResetRef={gestureResetRef}
          driverVersion={driverVersion}
          driverType={driverType}
          interactive={driverType === 'mouse'}
          onCubeMove={handleCubeMove}
          cloudConfig={cloudConfig}
        />
      ) : (
        <>
          <ControlBar onResetGyro={resetGyro} onResetState={resetState} disabled={!isConnected} />
          <CubeCanvas
            facelets={facelets}
            quaternion={quaternion}
            onRendererReady={(r) => { rendererRef.current = r }}
          />
          <OrientationConfig
            config={config}
            onSave={saveOrientationConfig}
            onUseCurrentOrientation={resetGyro}
            disabled={!isConnected}
          />
          <FaceletDebug facelets={facelets} />
          <MoveHistory moves={moves} />
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
          </div>
          {lastSession && (
            <SolveReplayer
              session={lastSession}
              renderer={rendererRef.current}
              onClose={clearSession}
            />
          )}
        </>
      )}
    </div>
  )
}
