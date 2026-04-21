import type { ReactNode, CSSProperties } from 'react'

interface DebugPanelProps {
  title: string
  warning?: ReactNode
  disabled?: boolean
  disabledHint?: ReactNode
  children: ReactNode
}

const boxStyle: CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ccc',
  padding: '12px 16px', borderRadius: 6, marginTop: 8,
}

export function DebugPanel({ title, warning, disabled, disabledHint, children }: DebugPanelProps) {
  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#aaa' }}>
        {title}
      </div>
      {warning && (
        <div style={{ color: '#e8a020', marginBottom: 8 }}>
          {warning}
        </div>
      )}
      {disabled ? (
        <>
          {disabledHint && (
            <div style={{ color: '#666', marginBottom: 8 }}>
              {disabledHint}
            </div>
          )}
          <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  )
}

export function buttonStyle(color: string, disabled = false): CSSProperties {
  return {
    alignSelf: 'flex-start', padding: '3px 10px', cursor: disabled ? 'default' : 'pointer',
    background: '#222', color, border: `1px solid ${color}`, borderRadius: 3, fontSize: 11,
    opacity: disabled ? 0.6 : 1,
  }
}
