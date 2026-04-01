import type { TimerStatus } from '../hooks/useTimer'

interface Props {
  elapsedMs: number
  status: TimerStatus
  armed: boolean
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2)
}

export function TimerDisplay({ elapsedMs, status, armed }: Props) {
  let color = '#aaa'
  let label = ''

  if (status === 'solving') color = '#ffffff'
  else if (status === 'solved') color = '#2ecc71'
  else if (armed) { color = '#f39c12'; label = 'Ready' }

  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      {label && (
        <div style={{ fontSize: 14, color: '#f39c12', marginBottom: 4, fontFamily: 'monospace' }}>
          {label}
        </div>
      )}
      <div style={{ fontSize: 72, fontWeight: 'bold', fontFamily: 'monospace', color, lineHeight: 1 }}>
        {formatTime(elapsedMs)}
      </div>
    </div>
  )
}
