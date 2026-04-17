import { useEffect, useRef } from 'react'
import type { PositionMove } from '../types/cube'

interface Props {
  moves: PositionMove[]
}

function moveLabel(move: PositionMove): string {
  return `${move.face}${move.direction === 'CCW' ? "'" : ''}`
}

export function MoveHistory({ moves }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [moves])

  return (
    <div style={{ padding: '8px 16px', background: '#0f3460', maxHeight: '80px', overflowY: 'auto' }}>
      <span style={{ color: '#aaa', fontSize: '13px' }}>
        {moves.length === 0 ? 'No moves yet' : moves.map(moveLabel).join(' ')}
      </span>
      <div ref={endRef} />
    </div>
  )
}
