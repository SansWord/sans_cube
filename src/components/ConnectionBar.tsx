import type React from 'react'
import type { ConnectionStatus } from '../drivers/CubeDriver'
import type { DriverType } from '../hooks/useCubeDriver'

interface Props {
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  mode: 'debug' | 'timer'
  onToggleMode: () => void
  battery: number | null
  driverType: DriverType
  onSwitchDriver: (type: DriverType) => void
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

export function ConnectionBar({ status, onConnect, onDisconnect, mode, onToggleMode, battery, driverType, onSwitchDriver }: Props) {
  const isConnected = status === 'connected'
  const batteryLabel = battery !== null ? `${battery}%` : 'NA%'
  const batteryStyle: React.CSSProperties = isConnected
    ? { color: battery !== null ? batteryColor(battery) : '#4caf50' }
    : { color: '#555', filter: 'grayscale(1)' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: '#16213e' }}>
      <button
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={status === 'connecting'}
        style={{ padding: '6px 14px' }}
      >
        {isConnected ? 'Disconnect' : 'Connect'}
      </button>
      <span style={{ color: isConnected ? '#4caf50' : '#aaa' }}>
        {STATUS_LABEL[status]}
      </span>
      <select
        value={driverType}
        onChange={(e) => onSwitchDriver(e.target.value as DriverType)}
        disabled={status === 'connecting'}
        style={{ padding: '4px 6px', background: '#0f3460', border: '1px solid #333', color: '#ccc', borderRadius: 4, fontSize: 12 }}
      >
        <option value="cube">Cube</option>
        <option value="mouse">Mouse</option>
      </select>
      <span style={{ marginLeft: 'auto', fontSize: 13, ...batteryStyle }}>
        🔋 {batteryLabel}
      </span>
      <button
        onClick={onToggleMode}
        style={{ padding: '6px 14px' }}
      >
        {mode === 'debug' ? 'Timer' : 'Debug'}
      </button>
      <a
        href="https://www.linkedin.com/in/sansword/"
        target="_blank"
        rel="noopener noreferrer"
        title="LinkedIn"
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0a66c2', textDecoration: 'none', fontSize: 12 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        Built by SansWord
      </a>
      <a
        href="https://github.com/SansWord/sans_cube/"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub"
        style={{ display: 'flex', alignItems: 'center', color: '#ccc', lineHeight: 0 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      </a>
    </div>
  )
}
