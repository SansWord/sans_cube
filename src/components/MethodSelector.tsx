import type { SolveMethod } from '../types/solve'
import { CFOP, ROUX, FREEFORM } from '../methods/index'

const METHODS: SolveMethod[] = [CFOP, ROUX, FREEFORM]

interface Props {
  method: SolveMethod
  onChange: (m: SolveMethod) => void
  disabled?: boolean
}

export function MethodSelector({ method, onChange, disabled }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <label style={{ color: '#888', fontSize: 12 }}>Method</label>
      <select
        value={method.id}
        onChange={(e) => {
          const m = METHODS.find((x) => x.id === e.target.value)
          if (m) onChange(m)
        }}
        disabled={disabled}
        style={{ padding: '3px 6px', fontSize: 12, background: '#161626', color: '#ccc', border: '1px solid #333', borderRadius: 4 }}
      >
        {METHODS.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </div>
  )
}
