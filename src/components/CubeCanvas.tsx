import React, { useEffect, useRef } from 'react'
import { CubeRenderer } from '../rendering/CubeRenderer'
import type { FaceHit } from '../rendering/CubeRenderer'
import type { Quaternion, Face } from '../types/cube'

interface Props {
  facelets: string
  quaternion: Quaternion
  onRendererReady?: (renderer: CubeRenderer) => void
  style?: React.CSSProperties
  interactive?: boolean
  onMove?: (face: Face, direction: 'CW' | 'CCW') => void
  onResetOrientation?: (resetFn: () => void) => void
  onOrbit?: (q: { x: number; y: number; z: number; w: number }) => void
}

interface DragState {
  startX: number
  startY: number
  hit: FaceHit | null
}

const MIN_DRAG_PX = 5

export function CubeCanvas({ facelets, quaternion, onRendererReady, style, interactive, onMove, onResetOrientation, onOrbit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const renderer = new CubeRenderer(canvasRef.current)
    rendererRef.current = renderer
    onRendererReady?.(renderer)
    onResetOrientation?.(() => rendererRef.current?.resetOrientation())

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
    rendererRef.current?.queueFaceletsUpdate(facelets)
  }, [facelets])

  useEffect(() => {
    if (!interactive) rendererRef.current?.setQuaternion(quaternion)
  }, [quaternion, interactive])

  // Shared drag logic — called by both mouse and touch handlers
  const handleDragStart = (clientX: number, clientY: number) => {
    if (!interactive || !rendererRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const hit = rendererRef.current.raycastFace(
      clientX - rect.left, clientY - rect.top,
      canvas.clientWidth, canvas.clientHeight,
    )
    dragRef.current = { startX: clientX, startY: clientY, hit: hit ?? null }
  }

  const handleDragMove = (movementX: number, movementY: number) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    if (dragRef.current.hit === null) {
      rendererRef.current.applyOrbitDelta(movementX, movementY)
      onOrbit?.(rendererRef.current.getOrbitQuaternionAsSensorSpace())
    }
  }

  const handleDragEnd = (clientX: number, clientY: number) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    const { startX, startY, hit } = dragRef.current
    dragRef.current = null
    if (hit !== null) {
      const dx = clientX - startX
      const dy = clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_PX) return
      const result = rendererRef.current.determineMoveFromDrag(hit, dx, dy)
      if (result) onMove?.(result.face, result.direction)
    }
  }

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => handleDragStart(e.clientX, e.clientY)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => handleDragMove(e.movementX, e.movementY)
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => handleDragEnd(e.clientX, e.clientY)
  const handleMouseLeave = () => { dragRef.current = null }

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0]
    if (!touch) return
    lastTouchPos.current = { x: touch.clientX, y: touch.clientY }
    handleDragStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0]
    if (!touch || !lastTouchPos.current) return
    const movementX = touch.clientX - lastTouchPos.current.x
    const movementY = touch.clientY - lastTouchPos.current.y
    lastTouchPos.current = { x: touch.clientX, y: touch.clientY }
    handleDragMove(movementX, movementY)
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.changedTouches[0]
    if (!touch) return
    lastTouchPos.current = null
    handleDragEnd(touch.clientX, touch.clientY)
  }

  return (
    <canvas
      ref={canvasRef}
      className="cube-canvas"
      style={{ width: '100%', display: 'block', cursor: interactive ? 'grab' : 'default', ...style, touchAction: 'none' }}
      onMouseDown={interactive ? handleMouseDown : undefined}
      onMouseMove={interactive ? handleMouseMove : undefined}
      onMouseUp={interactive ? handleMouseUp : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
      onTouchStart={interactive ? handleTouchStart : undefined}
      onTouchMove={interactive ? handleTouchMove : undefined}
      onTouchEnd={interactive ? handleTouchEnd : undefined}
    />
  )
}
