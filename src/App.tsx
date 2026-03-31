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
import { SolveReplayer } from './components/SolveReplayer'
import type { CubeRenderer } from './rendering/CubeRenderer'
import type { Move } from './types/cube'

export default function App() {
  const { driver, connect, disconnect, status } = useCubeDriver()
  const { facelets, isSolved, resetState } = useCubeState(driver)
  const { quaternion, config, resetGyro, saveOrientationConfig } = useGyro(driver)
  const { lastSession, clearSession } = useSolveRecorder(driver, isSolved)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const [moves, setMoves] = useState<Move[]>([])

  // Collect moves for MoveHistory
  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => setMoves((prev) => [...prev.slice(-100), m])
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver])

  // Trigger layer animation on each live move
  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onMove = (m: Move) => {
      rendererRef.current?.animateMove(m.face, m.direction, 150)
    }
    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver])

  useGestureDetector(driver, { resetGyro, resetState })

  const isConnected = status === 'connected'

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh' }}>
      <ConnectionBar status={status} onConnect={connect} onDisconnect={disconnect} />
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
      <MoveHistory moves={moves} />
      {lastSession && (
        <SolveReplayer
          session={lastSession}
          renderer={rendererRef.current}
          onClose={clearSession}
        />
      )}
    </div>
  )
}
