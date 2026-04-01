// Debug overlay: shows the logical facelet state as a 2D net
// Net layout:  [U]
//          [L] [F] [R] [B]
//               [D]

import { useState } from 'react'

const FACE_BG: Record<string, string> = {
  U: '#ffffff', R: '#cc0000', F: '#00aa00',
  D: '#ffff00', L: '#ff8800', B: '#0000cc',
}
const FACE_LABEL_COLOR: Record<string, string> = {
  U: '#000', R: '#fff', F: '#fff', D: '#000', L: '#fff', B: '#fff',
}

// Kociemba: U=0-8, R=9-17, F=18-26, D=27-35, L=36-44, B=45-53
const FACE_OFFSETS: Record<string, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 }

// Map a facelet character to its face key (for coloring)
function charToFace(ch: string): string {
  // SOLVED_FACELETS uses face letters: U R F D L B
  return ch
}

function FaceGrid({ facelets, face }: { facelets: string; face: string }) {
  const offset = FACE_OFFSETS[face]
  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(3, 12px)', gap: '1px' }}>
      {Array.from({ length: 9 }, (_, i) => {
        const ch = facelets[offset + i] ?? '?'
        const bg = FACE_BG[charToFace(ch)] ?? '#444'
        const color = FACE_LABEL_COLOR[charToFace(ch)] ?? '#fff'
        return (
          <div
            key={i}
            style={{
              width: 12, height: 12,
              background: bg,
              color,
              fontSize: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #333',
            }}
          >
            {i === 4 ? face : ''}
          </div>
        )
      })}
    </div>
  )
}

export function FaceletDebug({ facelets }: { facelets: string }) {
  const [show, setShow] = useState(false)
  const cell = (face: string) => <FaceGrid facelets={facelets} face={face} />
  const blank = <div style={{ display: 'inline-block', width: 38 }} />

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: 11,
      background: '#111',
      color: '#ccc',
      padding: '8px 12px',
      borderRadius: 6,
      marginTop: 8,
    }}>
      <div
        onClick={() => setShow(s => !s)}
        style={{ marginBottom: show ? 4 : 0, color: '#888', cursor: 'pointer', userSelect: 'none' }}
      >
        {show ? '▼' : '▶'} Facelet state
      </div>
      {show && <>
        {/* Row 1: U */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
          {blank}{cell('U')}
        </div>
        {/* Row 2: L F R B */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
          {cell('L')}{cell('F')}{cell('R')}{cell('B')}
        </div>
        {/* Row 3: D */}
        <div style={{ display: 'flex', gap: 2 }}>
          {blank}{cell('D')}
        </div>
        <div style={{ marginTop: 6, color: '#666', fontSize: 10 }}>
          {facelets}
        </div>
      </>}
    </div>
  )
}
