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

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const hit = rendererRef.current.raycastFace(px, py, canvas.clientWidth, canvas.clientHeight)
    dragRef.current = { startX: e.clientX, startY: e.clientY, hit: hit ?? null }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    if (dragRef.current.hit === null) {
      rendererRef.current.applyOrbitDelta(e.movementX, e.movementY)
      onOrbit?.(rendererRef.current.getOrbitQuaternionAsSensorSpace())
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    const { startX, startY, hit } = dragRef.current
    dragRef.current = null

    if (hit !== null) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_PX) return
      const result = rendererRef.current.determineMoveFromDrag(hit, dx, dy)
      if (result) onMove?.(result.face, result.direction)
    }
  }

  const handleMouseLeave = () => {
    dragRef.current = null
  }

  // Touch handlers — identical logic to mouse, adapted for TouchEvent
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !canvasRef.current) return
    const touch = e.touches[0]
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const px = touch.clientX - rect.left
    const py = touch.clientY - rect.top
    const hit = rendererRef.current.raycastFace(px, py, canvas.clientWidth, canvas.clientHeight)
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, hit: hit ?? null }
    lastTouchPos.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current || !lastTouchPos.current) return
    const touch = e.touches[0]
    const movementX = touch.clientX - lastTouchPos.current.x
    const movementY = touch.clientY - lastTouchPos.current.y
    lastTouchPos.current = { x: touch.clientX, y: touch.clientY }
    if (dragRef.current.hit === null) {
      rendererRef.current.applyOrbitDelta(movementX, movementY)
      onOrbit?.(rendererRef.current.getOrbitQuaternionAsSensorSpace())
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!interactive || !rendererRef.current || !dragRef.current) return
    const { startX, startY, hit } = dragRef.current
    dragRef.current = null
    lastTouchPos.current = null

    if (hit !== null) {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DRAG_PX) return
      const result = rendererRef.current.determineMoveFromDrag(hit, dx, dy)
      if (result) onMove?.(result.face, result.direction)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="cube-canvas"
      style={{ width: '100%', display: 'block', cursor: interactive ? 'grab' : 'default', touchAction: 'none', ...style }}
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
