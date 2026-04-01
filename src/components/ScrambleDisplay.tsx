import type { ScrambleStep } from '../types/solve'
import type { StepState, TrackingState } from '../hooks/useScrambleTracker'
import { scrambleStepToString } from '../utils/scramble'
import type { Move } from '../types/cube'

interface Props {
  scramble: string | null
  steps: ScrambleStep[]
  stepStates: StepState[]
  trackingState: TrackingState
  wrongMoves: Move[]
  onResetCube: () => void
  onResetGyro: () => void
}

const STATE_COLOR: Record<StepState, string> = {
  done: '#2ecc71',
  current: '#ffffff',
  pending: '#555',
  warning: '#f39c12',
}

export function ScrambleDisplay({
  scramble,
  steps,
  stepStates,
  trackingState,
  wrongMoves,
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
      {trackingState === 'wrong' && wrongMoves.length > 0 ? (
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e74c3c', fontFamily: 'monospace', marginBottom: 8, letterSpacing: 2 }}>
          {wrongMoves.slice().reverse().map((m, i) => (
            <span key={i} style={{ marginRight: 6 }}>
              {m.face}{m.direction === 'CW' ? "'" : ''}
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
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6 }}>
        <button onClick={onResetCube} style={{ padding: '6px 14px' }}>Reset Cube</button>
        <button onClick={onResetGyro} style={{ padding: '6px 14px' }}>Reset Gyro</button>
      </div>
    </div>
  )
}
