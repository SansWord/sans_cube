import { useRef, useState, useEffect } from 'react'
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
import type { Move } from './types/cube'

export default function App() {
  const { driver, connect, disconnect, status } = useCubeDriver()
  const { facelets, isSolved, isSolvedRef, resetState } = useCubeState(driver)
  const { quaternion, config, resetGyro, saveOrientationConfig } = useGyro(driver)
  const { lastSession, clearSession } = useSolveRecorder(driver, isSolved)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const isSolvingRef = useRef(false)
  const gestureResetRef = useRef<() => void>(resetState)
  const [moves, setMoves] = useState<Move[]>([])
  const [mode, setMode] = useState<'debug' | 'timer'>('timer')
  const [battery, setBattery] = useState<number | null>(null)

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onBattery = (pct: number) => setBattery(pct)
    d.on('battery', onBattery)
    return () => d.off('battery', onBattery)
  }, [driver])

  useEffect(() => {
    if (status === 'disconnected') setBattery(null)
  }, [status])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => setMoves((prev) => [...prev.slice(-100), m])
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => {
      rendererRef.current?.animateMove(m.face, m.direction, 150)
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver])

  useGestureDetector(driver, { resetGyro, resetState: () => gestureResetRef.current() }, isSolvedRef, isSolvingRef)

  const isConnected = status === 'connected'

  return (
    <div style={{ maxWidth: mode === 'timer' ? '100%' : '600px', margin: '0 auto', minHeight: '100vh' }}>
      <ConnectionBar
        status={status}
        onConnect={connect}
        onDisconnect={disconnect}
        mode={mode}
        onToggleMode={() => setMode((m) => (m === 'debug' ? 'timer' : 'debug'))}
        battery={battery}
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
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <button
              onClick={() => { localStorage.clear(); window.location.reload() }}
              style={{ padding: '6px 14px', color: '#e74c3c', border: '1px solid #e74c3c', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}
            >
              Clear localStorage
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
