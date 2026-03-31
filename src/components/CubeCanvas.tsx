import { useEffect, useRef } from 'react'
import { CubeRenderer } from '../rendering/CubeRenderer'
import type { Quaternion } from '../types/cube'

interface Props {
  facelets: string
  quaternion: Quaternion
  onRendererReady?: (renderer: CubeRenderer) => void
}

export function CubeCanvas({ facelets, quaternion, onRendererReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<CubeRenderer | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const renderer = new CubeRenderer(canvasRef.current)
    rendererRef.current = renderer
    onRendererReady?.(renderer)

    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      renderer.resize(canvas.clientWidth, canvas.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rendererRef.current?.updateFacelets(facelets)
  }, [facelets])

  useEffect(() => {
    rendererRef.current?.setQuaternion(quaternion)
  }, [quaternion])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '400px', display: 'block' }}
    />
  )
}
