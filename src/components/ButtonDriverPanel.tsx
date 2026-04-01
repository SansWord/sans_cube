import type { ButtonDriver } from '../drivers/ButtonDriver'
import type { Face } from '../types/cube'

interface Props {
  driver: ButtonDriver
}

const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L']

const btnStyle: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: 12,
  fontFamily: 'monospace',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid #333',
  color: '#ccc',
  borderRadius: 4,
  cursor: 'pointer',
  minWidth: 36,
}

export function ButtonDriverPanel({ driver }: Props) {
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a2e' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, auto)', gap: 6, justifyContent: 'center' }}>
        {FACES.map((face) => (
          <div key={face} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>{face}</div>
            <button style={btnStyle} onClick={() => driver.sendMove(face, 'CW')}>{face}</button>
            <button style={btnStyle} onClick={() => driver.sendMove(face, 'CCW')}>{face}'</button>
            <button style={btnStyle} onClick={() => driver.sendMove(face, 'CW', true)}>{face}2</button>
          </div>
        ))}
      </div>
    </div>
  )
}
