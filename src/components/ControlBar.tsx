interface Props {
  onResetGyro: () => void
  onResetState: () => void
  disabled: boolean
}

export function ControlBar({ onResetGyro, onResetState, disabled }: Props) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '8px 16px', background: '#0f3460' }}>
      <button onClick={onResetGyro} disabled={disabled} style={{ padding: '6px 14px' }}>
        Reset Gyro (U4)
      </button>
      <button onClick={onResetState} disabled={disabled} style={{ padding: '6px 14px' }}>
        Reset Cube State (D4)
      </button>
    </div>
  )
}
