import { useState, useEffect } from 'react'

export interface TrendsHashParams {
  tab: 'total' | 'phases'
  windowSize: 25 | 50 | 100 | 'all' | null
  grouped: boolean
  totalToggle: { exec: boolean; recog: boolean; total: boolean }
  phaseToggle: { exec: boolean; recog: boolean; total: boolean }
  method: 'all' | 'cfop' | 'roux' | null
  driver: 'all' | 'cube' | 'mouse' | null
}

export type Route =
  | { type: 'debug' }
  | { type: 'solve'; id: number }
  | { type: 'shared'; shareId: string }
  | { type: 'trends'; params: TrendsHashParams }
  | { type: 'none' }

function parseTimeToggle(raw: string | null): { exec: boolean; recog: boolean; total: boolean } {
  const set = new Set((raw ?? '').split(','))
  const t = { exec: set.has('exec'), recog: set.has('recog'), total: set.has('total') }
  if (!t.exec && !t.recog && !t.total) t.total = true
  return t
}

function parseTrendsParams(hash: string): TrendsHashParams {
  const search = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(search)
  const tab: 'total' | 'phases' = params.get('tab') === 'phases' ? 'phases' : 'total'
  const w = params.get('window')
  const windowSize: 25 | 50 | 100 | 'all' | null =
    w === 'all' ? 'all' : w === '50' ? 50 : w === '100' ? 100 : w === '25' ? 25 : null
  const grouped = params.get('group') !== 'split'
  const totalToggle = parseTimeToggle(params.get('ttotal'))
  const ptRaw = params.get('tphase') ?? 'total'
  const ptSet = new Set(ptRaw.split(','))
  const phaseToggle = { exec: ptSet.has('exec'), recog: ptSet.has('recog'), total: ptSet.has('total') }
  if (!phaseToggle.exec && !phaseToggle.recog && !phaseToggle.total) phaseToggle.total = true
  const methodRaw = params.get('method')
  const method = (['all', 'cfop', 'roux'] as const).includes(methodRaw as 'all')
    ? (methodRaw as 'all' | 'cfop' | 'roux')
    : null
  const driverRaw = params.get('driver')
  const driver = (['all', 'cube', 'mouse'] as const).includes(driverRaw as 'all')
    ? (driverRaw as 'all' | 'cube' | 'mouse')
    : null
  return { tab, windowSize, grouped, totalToggle, phaseToggle, method, driver }
}

export function parseHash(hash: string): Route {
  if (hash === '#debug') return { type: 'debug' }
  if (hash.startsWith('#solve-')) {
    const id = parseInt(hash.slice('#solve-'.length), 10)
    return isNaN(id) ? { type: 'none' } : { type: 'solve', id }
  }
  if (hash.startsWith('#shared-')) {
    const shareId = hash.slice('#shared-'.length)
    return shareId ? { type: 'shared', shareId } : { type: 'none' }
  }
  if (hash.startsWith('#trends')) {
    return { type: 'trends', params: parseTrendsParams(hash) }
  }
  return { type: 'none' }
}

export function useHashRouter(): { currentRoute: Route } {
  const [currentRoute, setCurrentRoute] = useState<Route>(
    () => parseHash(window.location.hash)
  )

  useEffect(() => {
    const handler = () => setCurrentRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', handler)
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('hashchange', handler)
      window.removeEventListener('popstate', handler)
    }
  }, [])

  return { currentRoute }
}
