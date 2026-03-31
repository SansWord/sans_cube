import type { CubeColor, OrientationConfig } from '../types/cube'

const COLORS: CubeColor[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green']

interface Props {
  config: OrientationConfig
  onSave: (updates: Partial<OrientationConfig>) => void
  onUseCurrentOrientation: () => void
  disabled: boolean
}

export function OrientationConfig({ config, onSave, onUseCurrentOrientation, disabled }: Props) {
  return (
    <div style={{ padding: '8px 16px', background: '#16213e', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        Front face:
        <select
          value={config.frontFace}
          onChange={(e) => onSave({ frontFace: e.target.value as CubeColor })}
        >
          {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        Bottom face:
        <select
          value={config.bottomFace}
          onChange={(e) => onSave({ bottomFace: e.target.value as CubeColor })}
        >
          {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <button onClick={onUseCurrentOrientation} disabled={disabled} style={{ padding: '6px 14px' }}>
        Use Current Orientation
      </button>
    </div>
  )
}
