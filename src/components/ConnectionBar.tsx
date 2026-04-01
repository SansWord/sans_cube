import type { ConnectionStatus } from '../drivers/CubeDriver'

interface Props {
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  mode: 'debug' | 'timer'
  onToggleMode: () => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
}

export function ConnectionBar({ status, onConnect, onDisconnect, mode, onToggleMode }: Props) {
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
      <button
        onClick={onToggleMode}
        style={{ padding: '6px 14px', marginLeft: 'auto' }}
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
