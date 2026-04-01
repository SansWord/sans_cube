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
}

const STATE_COLOR: Record<StepState, string> = {
  done: '#2ecc71',
  current: '#ffffff',
  pending: '#555',
  warning: '#f39c12',
}

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
}: Props) {
  if (scramble === null) {
    return (
      <div style={{ textAlign: 'center', color: '#666', fontSize: 14, padding: '16px 0' }}>
        Generating scramble…
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {trackingState === 'wrong' && wrongSegments.length > 0 ? (
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e74c3c', fontFamily: 'monospace', letterSpacing: 2 }}>
            {wrongSegments.slice().reverse().map((seg, i) => (
              <span key={i} style={{ marginRight: 6 }}>
                {segmentToCancel(seg)}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 2, lineHeight: 2 }}>
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
        <button
          onClick={onRegenerate}
          title={regeneratePending ? 'Waiting for solved state…' : 'New scramble'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: regeneratePending ? '#f39c12' : '#666',
            padding: '2px 4px',
            lineHeight: 1,
          }}
        >
          ↻
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6 }}>
        <button onClick={onResetCube} style={{ padding: '6px 14px' }}>Reset Cube</button>
        <button onClick={onResetGyro} style={{ padding: '6px 14px' }}>Reset Gyro</button>
      </div>
    </div>
  )
}
