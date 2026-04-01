import type { ConnectionStatus } from '../drivers/CubeDriver'

interface Props {
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  mode: 'debug' | 'timer'
  onToggleMode: () => void
  battery: number | null
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
}

function batteryColor(pct: number): string {
  if (pct > 50) return '#4caf50'
  if (pct > 20) return '#ff9800'
  return '#e74c3c'
}

export function ConnectionBar({ status, onConnect, onDisconnect, mode, onToggleMode, battery }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: '#16213e' }}>
      <button
        onClick={onConnect}
        disabled={status !== 'disconnected'}
        style={{ padding: '6px 14px' }}
      >
        Connect
      </button>
      <span style={{ color: status === 'connected' ? '#4caf50' : '#aaa' }}>
        {STATUS_LABEL[status]}
      </span>
      {battery !== null && (
        <span style={{ marginLeft: 'auto', fontSize: 13, color: batteryColor(battery) }}>
          🔋 {battery}%
        </span>
      )}
      <button
        onClick={onToggleMode}
        style={{ padding: '6px 14px', marginLeft: battery !== null ? 0 : 'auto' }}
      >
        {mode === 'debug' ? 'Timer' : 'Debug'}
      </button>
      <button
        onClick={onDisconnect}
        disabled={status !== 'connected'}
        style={{ padding: '6px 14px' }}
      >
        Disconnect
      </button>
    </div>
  )
}
