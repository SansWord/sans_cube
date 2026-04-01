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
        onClick={onConnect}
        disabled={status !== 'disconnected'}
        style={{ padding: '6px 14px' }}
      >
        Connect
      </button>
      <span style={{ color: isConnected ? '#4caf50' : '#aaa' }}>
        {STATUS_LABEL[status]}
      </span>
      <select
        value={driverType}
        onChange={(e) => onSwitchDriver(e.target.value as DriverType)}
        disabled={status === 'connected'}
        style={{ padding: '4px 6px', background: '#0f3460', border: '1px solid #333', color: '#ccc', borderRadius: 4, fontSize: 12 }}
      >
        <option value="gan">GAN Cube</option>
        <option value="button">Button</option>
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
