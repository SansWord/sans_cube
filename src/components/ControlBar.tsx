interface Props {
  onResetGyro: () => void
  onResetState: () => void
  onResetCenters: () => void
  disabled: boolean
}

export function ControlBar({ onResetGyro, onResetState, onResetCenters, disabled }: Props) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '8px 16px', background: '#0f3460' }}>
      <button onClick={onResetGyro} disabled={disabled} style={{ padding: '6px 14px' }}>
        Reset Gyro (U4)
      </button>
      <button onClick={onResetState} disabled={disabled} style={{ padding: '6px 14px' }}>
        Reset Cube State (D4)
      </button>
      <button onClick={onResetCenters} disabled={disabled} style={{ padding: '6px 14px' }}>
        Reset Center Tracking
      </button>
    </div>
  )
}
