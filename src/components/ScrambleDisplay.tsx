import { useState, useEffect, useRef } from 'react'
import type { ScrambleStep } from '../types/solve'
import type { StepState, TrackingState, WrongSegment } from '../hooks/useScrambleTracker'
import { scrambleStepToString } from '../utils/scramble'

interface Props {
  scramble: string | null
  steps: ScrambleStep[]
  stepStates: StepState[]
  trackingState: TrackingState
  wrongSegments: WrongSegment[]
  regeneratePending: boolean
  onRegenerate: () => void
  onResetCube: () => void
  onResetGyro: () => void
  onAutoScramble?: () => void
  onLoad?: (scramble: string) => void
}

const STATE_COLOR: Record<StepState, string> = {
  done: '#2ecc71',
  current: '#ffffff',
  pending: '#555',
  warning: '#f39c12',
}

const WRONG_SEQUENCE_LIMIT = 10

function segmentToCancel(seg: WrongSegment): string {
  const net4 = ((seg.netTurns % 4) + 4) % 4
  if (net4 === 1) return seg.face + "'"  // 1 CW → cancel with CCW
  if (net4 === 2) return seg.face + '2'  // 2 → cancel with double
  if (net4 === 3) return seg.face        // 3 CW ≡ -1 → cancel with 1 CW
  return ''
}

export function ScrambleDisplay({
  scramble,
  steps,
  stepStates,
  trackingState,
  wrongSegments,
  regeneratePending,
  onRegenerate,
  onResetCube,
  onResetGyro,
  onAutoScramble,
  onLoad,
}: Props) {
  const [showFullSequence, setShowFullSequence] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleEditOpen = () => {
    setEditValue(scramble ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleEditSubmit = () => {
    const trimmed = editValue.trim()
    if (trimmed && onLoad) onLoad(trimmed)
    setEditing(false)
  }

  // Reset the toggle whenever we exit wrong mode or the sequence drops back within the limit
  useEffect(() => {
    if (trackingState !== 'wrong') setShowFullSequence(false)
  }, [trackingState])

  useEffect(() => {
    if (wrongSegments.length <= WRONG_SEQUENCE_LIMIT) setShowFullSequence(false)
  }, [wrongSegments.length])

  if (scramble === null) {
    return (
      <div style={{ textAlign: 'center', color: '#666', fontSize: 14, padding: '16px 0' }}>
        Generating scramble…
      </div>
    )
  }

  const inWrong = trackingState === 'wrong' && wrongSegments.length > 0
  const tooLong = wrongSegments.length > WRONG_SEQUENCE_LIMIT

  return (
    <div style={{ textAlign: 'center', padding: '8px 0', width: '100%' }}>
      {editing && onLoad ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 80 }}>
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEditSubmit(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="e.g. M U M' U' M U2 M'"
            style={{ fontFamily: 'monospace', fontSize: 18, padding: '6px 10px', background: '#111', color: '#fff', border: '1px solid #555', borderRadius: 4, width: 360 }}
          />
          <button onClick={handleEditSubmit} style={{ padding: '6px 12px', fontSize: 14 }}>Load</button>
          <button onClick={() => setEditing(false)} style={{ padding: '6px 10px', fontSize: 14, background: 'none', border: '1px solid #555', color: '#aaa', borderRadius: 4, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div className="scramble-area" style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {inWrong ? (
            tooLong && !showFullSequence ? (
              <span
                onClick={() => setShowFullSequence(true)}
                style={{ fontSize: 20, fontWeight: 'bold', color: '#e74c3c', cursor: 'pointer' }}
                title="Click to see full cancellation sequence"
              >
                Reset Cube
              </span>
            ) : (
              <div className="scramble-moves" style={{ fontSize: 28, fontWeight: 'bold', color: '#e74c3c', fontFamily: 'monospace', letterSpacing: 2, width: '100%', textAlign: 'center' }}>
                {wrongSegments.slice().reverse().map((seg, i) => (
                  <span key={i} style={{ marginRight: 6 }}>
                    {segmentToCancel(seg)}
                  </span>
                ))}
              </div>
            )
          ) : (
            <div className="scramble-moves" style={{ fontFamily: 'monospace', fontSize: 28, letterSpacing: 2, lineHeight: 1.5, width: '100%', textAlign: 'center' }}>
              {steps.map((step, i) => (
                <span
                  key={i}
                  style={{
                    color: STATE_COLOR[stepStates[i] ?? 'pending'],
                    marginRight: 6,
                    fontWeight: stepStates[i] === 'current' ? 'bold' : 'normal',
                  }}
                >
                  {scrambleStepToString(step)}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onRegenerate}
          title={regeneratePending ? 'Waiting for cube to be solved…' : 'Re-generate scramble pattern'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 22,
            color: regeneratePending ? '#f39c12' : '#fff',
            padding: '2px 4px',
            lineHeight: 1,
          }}
        >
          ↻
        </button>
        {onLoad && (
          <button
            onClick={handleEditOpen}
            title="Enter a custom scramble"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#777', padding: '2px 4px', lineHeight: 1 }}
          >
            ✎
          </button>
        )}
      </div>
      )} {/* end editing conditional */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6 }}>
        <button onClick={onResetCube} style={{ padding: '6px 14px' }}>Reset Cube</button>
        <button onClick={onResetGyro} style={{ padding: '6px 14px' }}>Reset Gyro</button>
        {onAutoScramble && (
          <button onClick={onAutoScramble} style={{ padding: '6px 14px' }}>Auto Scramble</button>
        )}
      </div>
    </div>
  )
}
