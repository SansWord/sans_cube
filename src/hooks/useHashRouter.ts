import { useState, useEffect, useCallback } from 'react'
import type { SortMode } from '../utils/trends'

export interface TrendsHashParams {
  tab: 'total' | 'phases'
  windowSize: 25 | 50 | 100 | 'all' | null
  grouped: boolean
  totalToggle: { exec: boolean; recog: boolean; total: boolean }
  phaseToggle: { exec: boolean; recog: boolean; total: boolean }
  method: 'all' | 'cfop' | 'roux' | 'freeform' | null
  driver: 'all' | 'cube' | 'mouse' | null
  sortMode: SortMode
  zoom: Array<[number, number]>
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

function parseZoomStack(raw: string | null): Array<[number, number]> {
  if (!raw) return []
  const stack: Array<[number, number]> = []
  for (const pair of raw.split('|')) {
    const [a, b] = pair.split(',').map(Number)
    if (Number.isFinite(a) && Number.isFinite(b) && a <= b) stack.push([a, b])
  }
  return stack
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
  const method = (['all', 'cfop', 'roux', 'freeform'] as const).includes(methodRaw as 'all')
    ? (methodRaw as 'all' | 'cfop' | 'roux' | 'freeform')
    : null
  const driverRaw = params.get('driver')
  const driver = (['all', 'cube', 'mouse'] as const).includes(driverRaw as 'all')
    ? (driverRaw as 'all' | 'cube' | 'mouse')
    : null
  const sortMode: SortMode = params.get('sort') === 'date' ? 'date' : 'seq'
  const zoom = parseZoomStack(params.get('zoom'))
  return { tab, windowSize, grouped, totalToggle, phaseToggle, method, driver, sortMode, zoom }
}

export function serializeZoomStack(stack: Array<[number, number]>): string {
  return stack.map(([a, b]) => `${a},${b}`).join('|')
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

export type SelectedSolveUrlAction =
  | { kind: 'noop' }
  | { kind: 'open-push'; id: number; saveTrendsHash: boolean }
  | { kind: 'open-replace'; id: number }
  | { kind: 'restore-trends'; hash: string }
  | { kind: 'clear' }

// The prev=null && current=null branch returns 'noop' to avoid a boot-time
// URL wipe when `#solve-{id}` opens on first render with cloud sync disabled.
// Without the guard the Write-URL effect fires in the same render as the boot
// resolve effect, sees selectedSolve still null, and ping-pongs the modal.
export function decideSelectedSolveUrlAction(
  prevSelectedId: number | null,
  currentSelectedId: number | null,
  savedTrendsHash: string,
  showTrends: boolean,
): SelectedSolveUrlAction {
  if (currentSelectedId !== null) {
    if (prevSelectedId === null) {
      return { kind: 'open-push', id: currentSelectedId, saveTrendsHash: showTrends }
    }
    return { kind: 'open-replace', id: currentSelectedId }
  }
  if (prevSelectedId === null) return { kind: 'noop' }
  if (savedTrendsHash) return { kind: 'restore-trends', hash: savedTrendsHash }
  return { kind: 'clear' }
}

export type SharedSolveUrlAction =
  | { kind: 'noop' }
  | { kind: 'open-push'; shareId: string }
  | { kind: 'open-replace'; shareId: string }
  | { kind: 'clear' }

// `open-replace` when the current hash already matches the target avoids the
// duplicate history entry that the previous unconditional pushState produced
// when the user arrived directly at `#shared-{id}`.
export function decideSharedSolveUrlAction(
  prevShareId: string | null,
  currentShareId: string | null,
  currentHash: string,
  isLoading: boolean,
): SharedSolveUrlAction {
  if (currentShareId !== null) {
    if (prevShareId !== null) return { kind: 'noop' }
    return currentHash === `#shared-${currentShareId}`
      ? { kind: 'open-replace', shareId: currentShareId }
      : { kind: 'open-push', shareId: currentShareId }
  }
  if (prevShareId !== null && !isLoading) return { kind: 'clear' }
  return { kind: 'noop' }
}

function routesEqual(a: Route, b: Route): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'solve' && b.type === 'solve') return a.id === b.id
  if (a.type === 'shared' && b.type === 'shared') return a.shareId === b.shareId
  if (a.type === 'trends' && b.type === 'trends') return JSON.stringify(a.params) === JSON.stringify(b.params)
  return true
}

export function useHashRouter(): { currentRoute: Route; navigate: (route: Route) => void } {
  const [currentRoute, setCurrentRoute] = useState<Route>(
    () => parseHash(window.location.hash)
  )

  useEffect(() => {
    const handler = () => {
      const next = parseHash(window.location.hash)
      setCurrentRoute(prev => routesEqual(prev, next) ? prev : next)
    }
    window.addEventListener('hashchange', handler)
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('hashchange', handler)
      window.removeEventListener('popstate', handler)
    }
  }, [])

  const navigate = useCallback((route: Route) => {
    setCurrentRoute(prev => routesEqual(prev, route) ? prev : route)
  }, [])

  return { currentRoute, navigate }
}
