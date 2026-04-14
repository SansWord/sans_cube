import { useState } from 'react'
import { STORAGE_KEYS } from '../utils/storageKeys'

export function AnalyticsBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.ANALYTICS_ACKNOWLEDGED) === 'true'
  )

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEYS.ANALYTICS_ACKNOWLEDGED, 'true')
    setDismissed(true)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#0a0a1a',
      borderTop: '1px solid #222',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      zIndex: 200,
      fontSize: 12,
      color: '#888',
    }}>
      <span>This site uses analytics to improve the experience.</span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: '1px solid #333',
          color: '#888',
          fontSize: 11,
          padding: '2px 10px',
          borderRadius: 3,
          cursor: 'pointer',
          flexShrink: 0,
          marginLeft: 16,
        }}
      >
        Got it
      </button>
    </div>
  )
}
