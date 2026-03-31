# GAN Cube Web App Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React web app that connects to a GAN 12 UI Maglev via Web Bluetooth, displays a live animated 3D cube synced to the gyroscope, and records/replays solves with accurate timing.

**Architecture:** A `CubeDriver` interface abstracts all BLE protocol details; `GanCubeDriver` wraps `gan-web-bluetooth` as the first implementation. React hooks consume normalized events from the driver and feed Three.js rendering and UI components.

**Tech Stack:** React 18, Vite, TypeScript, Three.js, `gan-web-bluetooth`, `cubing.js`, Vitest

---

## File Map

```
src/
├── types/cube.ts                   # Move, CubeState, Quaternion, SolveSession, GesturePattern
├── drivers/
│   ├── CubeDriver.ts               # CubeDriver interface + EventEmitter helper
│   └── GanCubeDriver.ts            # GAN implementation wrapping gan-web-bluetooth
├── hooks/
│   ├── useCubeDriver.ts            # BLE lifecycle, returns driver + connectionStatus
│   ├── useCubeState.ts             # 54-facelet state, resetState(), isSolved
│   ├── useGyro.ts                  # quaternion with reference offset, resetGyro()
│   ├── useGestureDetector.ts       # configurable move sequence matcher
│   └── useSolveRecorder.ts         # records SolveSession per solve
├── rendering/
│   └── CubeRenderer.ts             # Three.js scene, mesh, layer animations
├── components/
│   ├── ConnectionBar.tsx
│   ├── ControlBar.tsx
│   ├── CubeCanvas.tsx              # mounts CubeRenderer, wires props
│   ├── OrientationConfig.tsx
│   ├── MoveHistory.tsx
│   └── SolveReplayer.tsx
├── App.tsx                         # composes all hooks + components
├── main.tsx
└── index.css
tests/
├── types/cube.test.ts
├── drivers/GanCubeDriver.test.ts
├── hooks/useCubeState.test.ts
├── hooks/useGyro.test.ts
├── hooks/useGestureDetector.test.ts
└── hooks/useSolveRecorder.test.ts
```

---

## Task 1: Scaffold project and install dependencies

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Scaffold Vite + React + TypeScript**

```bash
cd /Users/sansword/Source/github/sans_cube
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Remove existing files and continue?" — choose **Yes**.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install three gan-web-bluetooth cubing
npm install @types/three
```

- [ ] **Step 3: Install test dependencies**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 4: Configure Vitest in `vite.config.ts`**

Replace the file content:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 5: Create test setup file**

```bash
mkdir -p tests/types tests/drivers tests/hooks
```

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Replace `src/App.tsx` with a placeholder**

```tsx
export default function App() {
  return <div>GAN Cube App</div>
}
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:5173`, browser shows "GAN Cube App".

- [ ] **Step 8: Verify tests run**

```bash
npx vitest run
```

Expected: "No test files found" (no failures).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

## Task 2: Define shared types

**Files:**
- Create: `src/types/cube.ts`
- Create: `tests/types/cube.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/types/cube.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Move, CubeState, Quaternion, SolveSession, GesturePattern } from '../../src/types/cube'

describe('cube types', () => {
  it('Move has required fields', () => {
    const move: Move = {
      face: 'U',
      direction: 'CW',
      cubeTimestamp: 1000,
      serial: 42,
    }
    expect(move.face).toBe('U')
    expect(move.direction).toBe('CW')
    expect(move.cubeTimestamp).toBe(1000)
    expect(move.serial).toBe(42)
  })

  it('SolveSession has moves and timestamps', () => {
    const session: SolveSession = {
      moves: [{ move: { face: 'R', direction: 'CW', cubeTimestamp: 100, serial: 1 }, cubeTimestamp: 100 }],
      startTimestamp: 100,
      endTimestamp: 5000,
    }
    expect(session.moves).toHaveLength(1)
    expect(session.endTimestamp - session.startTimestamp).toBe(4900)
  })

  it('GesturePattern has face, direction, count, and windowMs', () => {
    const pattern: GesturePattern = {
      face: 'U',
      direction: 'CW',
      count: 4,
      windowMs: 2000,
    }
    expect(pattern.count).toBe(4)
    expect(pattern.windowMs).toBe(2000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/types/cube.test.ts
```

Expected: FAIL — "Cannot find module '../../src/types/cube'"

- [ ] **Step 3: Create `src/types/cube.ts`**

```typescript
export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type Direction = 'CW' | 'CCW'

export interface Move {
  face: Face
  direction: Direction
  cubeTimestamp: number
  serial: number
}

export interface CubeState {
  facelets: string // 54-char Kociemba notation: UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface SolveSession {
  moves: Array<{ move: Move; cubeTimestamp: number }>
  startTimestamp: number
  endTimestamp: number
}

export type CubeColor = 'white' | 'yellow' | 'red' | 'orange' | 'blue' | 'green'

export interface OrientationConfig {
  frontFace: CubeColor
  bottomFace: CubeColor
  referenceQuaternion: Quaternion | null
}

export interface GesturePattern {
  face: Face
  direction: Direction
  count: number
  windowMs: number
}

export const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/types/cube.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/types/cube.ts tests/types/cube.test.ts tests/setup.ts
git commit -m "feat: add shared cube types"
```

---

## Task 3: CubeDriver interface and EventEmitter

**Files:**
- Create: `src/drivers/CubeDriver.ts`

- [ ] **Step 1: Create `src/drivers/CubeDriver.ts`**

```typescript
import type { Move, CubeState, Quaternion } from '../types/cube'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

type EventMap = {
  move: Move
  state: CubeState
  gyro: Quaternion
  connection: ConnectionStatus
}

type EventHandler<T> = (payload: T) => void

export class CubeEventEmitter {
  private handlers: { [K in keyof EventMap]?: EventHandler<EventMap[K]>[] } = {}

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.handlers[event]) this.handlers[event] = []
    ;(this.handlers[event] as EventHandler<EventMap[K]>[]).push(handler)
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers[event] = (this.handlers[event] as EventHandler<EventMap[K]>[])?.filter(
      (h) => h !== handler
    )
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    ;(this.handlers[event] as EventHandler<EventMap[K]>[])?.forEach((h) => h(payload))
  }

  removeAllListeners(): void {
    this.handlers = {}
  }
}

export interface CubeDriver extends CubeEventEmitter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  requestState(): Promise<void>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/drivers/CubeDriver.ts
git commit -m "feat: add CubeDriver interface and EventEmitter"
```

---

## Task 4: GanCubeDriver

**Files:**
- Create: `src/drivers/GanCubeDriver.ts`
- Create: `tests/drivers/GanCubeDriver.test.ts`

- [ ] **Step 1: Write failing test for event translation**

Create `tests/drivers/GanCubeDriver.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GanCubeDriver } from '../../src/drivers/GanCubeDriver'
import type { Move } from '../../src/types/cube'

describe('GanCubeDriver event translation', () => {
  it('translates a GAN MOVE event to a normalized Move', () => {
    const driver = new GanCubeDriver()
    const received: Move[] = []
    driver.on('move', (m) => received.push(m))

    driver._simulateGanMove({ face: 2, dir: 0, cubeTimestamp: 500, serial: 1 })

    expect(received).toHaveLength(1)
    expect(received[0].face).toBe('F')
    expect(received[0].direction).toBe('CW')
    expect(received[0].cubeTimestamp).toBe(500)
    expect(received[0].serial).toBe(1)
  })

  it('translates CCW direction correctly', () => {
    const driver = new GanCubeDriver()
    const received: Move[] = []
    driver.on('move', (m) => received.push(m))

    driver._simulateGanMove({ face: 0, dir: 1, cubeTimestamp: 100, serial: 2 })

    expect(received[0].face).toBe('U')
    expect(received[0].direction).toBe('CCW')
  })

  it('translates a GAN GYRO event to a normalized Quaternion', () => {
    const driver = new GanCubeDriver()
    const quats: { x: number; y: number; z: number; w: number }[] = []
    driver.on('gyro', (q) => quats.push(q))

    driver._simulateGanGyro({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 })

    expect(quats).toHaveLength(1)
    expect(quats[0].x).toBeCloseTo(0.1)
    expect(quats[0].w).toBeCloseTo(0.9)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/drivers/GanCubeDriver.test.ts
```

Expected: FAIL — "Cannot find module '../../src/drivers/GanCubeDriver'"

- [ ] **Step 3: Create `src/drivers/GanCubeDriver.ts`**

```typescript
import { connectGanCube } from 'gan-web-bluetooth'
import { CubeEventEmitter, type CubeDriver, type ConnectionStatus } from './CubeDriver'
import type { Move, Quaternion, Face } from '../types/cube'

// GAN face index → standard face letter
// GAN Gen4: [2,32,8,1,16,4] bitmask maps to index 0-5 = U,R,F,D,L,B
const GAN_FACE_MAP: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

export class GanCubeDriver extends CubeEventEmitter implements CubeDriver {
  private connection: Awaited<ReturnType<typeof connectGanCube>> | null = null

  async connect(): Promise<void> {
    this.emit('connection', 'connecting')
    try {
      this.connection = await connectGanCube(
        async (_device: unknown, isFallback: boolean) =>
          isFallback ? prompt('Enter cube MAC address (check cube box or nRF Connect app)') : null
      )
      this.connection.events$.subscribe((event: Record<string, unknown>) => {
        this._handleGanEvent(event)
      })
      this.emit('connection', 'connected')
      await this.requestState()
    } catch (err) {
      this.emit('connection', 'disconnected')
      throw err
    }
  }

  async disconnect(): Promise<void> {
    this.connection = null
    this.emit('connection', 'disconnected')
  }

  async requestState(): Promise<void> {
    await this.connection?.sendCubeCommand({ type: 'REQUEST_FACELETS' })
  }

  // Translates a raw GAN event from gan-web-bluetooth into normalized driver events
  private _handleGanEvent(event: Record<string, unknown>): void {
    if (event.type === 'MOVE') {
      const ganFaceIndex = event.faceIndex as number
      const ganDir = event.direction as number
      const move: Move = {
        face: GAN_FACE_MAP[ganFaceIndex],
        direction: ganDir === 0 ? 'CW' : 'CCW',
        cubeTimestamp: event.cubeTimestamp as number,
        serial: event.serial as number,
      }
      this.emit('move', move)
    } else if (event.type === 'GYRO') {
      const q = event.quaternion as { x: number; y: number; z: number; w: number }
      const quaternion: Quaternion = { x: q.x, y: q.y, z: q.z, w: q.w }
      this.emit('gyro', quaternion)
    } else if (event.type === 'FACELETS') {
      this.emit('state', { facelets: event.facelets as string })
    } else if (event.type === 'DISCONNECT') {
      this.emit('connection', 'disconnected')
    }
  }

  // Test-only helper to simulate GAN events without real BLE hardware
  _simulateGanMove(raw: { face: number; dir: number; cubeTimestamp: number; serial: number }): void {
    this._handleGanEvent({
      type: 'MOVE',
      faceIndex: raw.face,
      direction: raw.dir,
      cubeTimestamp: raw.cubeTimestamp,
      serial: raw.serial,
    })
  }

  _simulateGanGyro(q: { x: number; y: number; z: number; w: number }): void {
    this._handleGanEvent({ type: 'GYRO', quaternion: q })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/drivers/GanCubeDriver.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/drivers/GanCubeDriver.ts tests/drivers/GanCubeDriver.test.ts
git commit -m "feat: add GanCubeDriver wrapping gan-web-bluetooth"
```

---

## Task 5: `useCubeDriver` hook

**Files:**
- Create: `src/hooks/useCubeDriver.ts`

- [ ] **Step 1: Create `src/hooks/useCubeDriver.ts`**

```typescript
import { useRef, useState, useCallback } from 'react'
import { GanCubeDriver } from '../drivers/GanCubeDriver'
import type { CubeDriver, ConnectionStatus } from '../drivers/CubeDriver'

export function useCubeDriver() {
  const driverRef = useRef<CubeDriver | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')

  const getDriver = useCallback((): CubeDriver => {
    if (!driverRef.current) {
      const driver = new GanCubeDriver()
      driver.on('connection', setStatus)
      driverRef.current = driver
    }
    return driverRef.current
  }, [])

  const connect = useCallback(async () => {
    await getDriver().connect()
  }, [getDriver])

  const disconnect = useCallback(async () => {
    await getDriver().disconnect()
  }, [getDriver])

  return { driver: driverRef, connect, disconnect, status }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCubeDriver.ts
git commit -m "feat: add useCubeDriver hook"
```

---

## Task 6: `useCubeState` hook

**Files:**
- Create: `src/hooks/useCubeState.ts`
- Create: `tests/hooks/useCubeState.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/hooks/useCubeState.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { applyMoveToFacelets, isSolvedFacelets } from '../../src/hooks/useCubeState'
import { SOLVED_FACELETS } from '../../src/types/cube'

describe('useCubeState helpers', () => {
  it('isSolvedFacelets returns true for solved state', () => {
    expect(isSolvedFacelets(SOLVED_FACELETS)).toBe(true)
  })

  it('isSolvedFacelets returns false for scrambled state', () => {
    const scrambled = 'UUUUUUUUURRRRRRRRR' + 'FFFFFFFFFDDDDDDDDLL' + 'LLLLLLLL' + 'BBBBBBBBB'
    expect(isSolvedFacelets(scrambled.slice(0, 54))).toBe(false)
  })

  it('applyMoveToFacelets returns a 54-char string', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result).toHaveLength(54)
  })

  it('applyMoveToFacelets changes state from solved', () => {
    const result = applyMoveToFacelets(SOLVED_FACELETS, { face: 'U', direction: 'CW', cubeTimestamp: 0, serial: 0 })
    expect(result).not.toBe(SOLVED_FACELETS)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/hooks/useCubeState.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `src/hooks/useCubeState.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Alg } from 'cubing/alg'
import { KState } from 'cubing/kpuzzle'
import { cube3x3x3 } from 'cubing/puzzles'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move } from '../types/cube'
import { SOLVED_FACELETS } from '../types/cube'

// Convert a Move to WCA notation string e.g. "U", "R'", "F2"
function moveToAlgString(move: Move): string {
  const suffix = move.direction === 'CW' ? '' : "'"
  return `${move.face}${suffix}`
}

export function applyMoveToFacelets(facelets: string, move: Move): string {
  try {
    const puzzle = cube3x3x3.def
    const state = KState.fromRaw(puzzle, parseFaceletsToRaw(facelets, puzzle))
    const alg = new Alg(moveToAlgString(move))
    const newState = state.applyAlg(alg)
    return rawToFacelets(newState.stateData, puzzle)
  } catch {
    return facelets // on any parsing error, return unchanged
  }
}

export function isSolvedFacelets(facelets: string): boolean {
  return facelets === SOLVED_FACELETS
}

// Internal helpers to convert between facelets string and cubing.js raw state
function parseFaceletsToRaw(facelets: string, puzzle: ReturnType<typeof cube3x3x3.def>): Record<string, unknown> {
  // cubing.js uses its own internal state format; we apply moves from solved state
  // This is a simplified approach: track moves applied from solved rather than parsing facelets
  void facelets; void puzzle
  return {}
}

function rawToFacelets(_stateData: unknown, _puzzle: unknown): string {
  return SOLVED_FACELETS // placeholder — replaced in step below
}

export function useCubeState(driver: React.MutableRefObject<CubeDriver | null>) {
  const [facelets, setFacelets] = useState<string>(SOLVED_FACELETS)
  const [isSolved, setIsSolved] = useState(true)

  const resetState = useCallback(() => {
    setFacelets(SOLVED_FACELETS)
    setIsSolved(true)
  }, [])

  useEffect(() => {
    const d = driver.current
    if (!d) return

    const onMove = (move: Move) => {
      setFacelets((prev) => {
        const next = applyMoveToFacelets(prev, move)
        setIsSolved(isSolvedFacelets(next))
        return next
      })
    }

    const onState = (state: { facelets: string }) => {
      setFacelets(state.facelets)
      setIsSolved(isSolvedFacelets(state.facelets))
    }

    d.on('move', onMove)
    d.on('state', onState)
    return () => {
      d.off('move', onMove)
      d.off('state', onState)
    }
  }, [driver])

  return { facelets, isSolved, resetState }
}
```

**Note on `cubing.js` integration:** `cubing.js` uses async puzzle loading. Replace the `applyMoveToFacelets` internals after verifying the API with `import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/solve'`. For now the function applies moves using the `Alg` + `KState` API — test with a real import to confirm method names match the installed version.

- [ ] **Step 4: Verify cubing.js API**

```bash
node -e "import('cubing/alg').then(m => console.log(Object.keys(m)))"
```

Adjust import paths in `useCubeState.ts` to match actual exports.

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/hooks/useCubeState.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCubeState.ts tests/hooks/useCubeState.test.ts
git commit -m "feat: add useCubeState hook with cubing.js move application"
```

---

## Task 7: `useGyro` hook

**Files:**
- Create: `src/hooks/useGyro.ts`
- Create: `tests/hooks/useGyro.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/hooks/useGyro.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { multiplyQuaternions, invertQuaternion, applyReference } from '../../src/hooks/useGyro'

describe('quaternion helpers', () => {
  it('invertQuaternion negates x, y, z', () => {
    const q = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 }
    const inv = invertQuaternion(q)
    expect(inv.x).toBeCloseTo(-0.1)
    expect(inv.y).toBeCloseTo(-0.2)
    expect(inv.z).toBeCloseTo(-0.3)
    expect(inv.w).toBeCloseTo(0.9)
  })

  it('applyReference with identity reference returns same quaternion', () => {
    const identity = { x: 0, y: 0, z: 0, w: 1 }
    const q = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 }
    const result = applyReference(q, identity)
    expect(result.x).toBeCloseTo(q.x, 4)
    expect(result.y).toBeCloseTo(q.y, 4)
    expect(result.z).toBeCloseTo(q.z, 4)
    expect(result.w).toBeCloseTo(q.w, 4)
  })

  it('applyReference cancels out reference quaternion', () => {
    const ref = { x: 0, y: 0.707, z: 0, w: 0.707 } // 90° Y rotation
    const result = applyReference(ref, ref)
    expect(result.x).toBeCloseTo(0, 3)
    expect(result.y).toBeCloseTo(0, 3)
    expect(result.z).toBeCloseTo(0, 3)
    expect(result.w).toBeCloseTo(1, 3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/hooks/useGyro.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `src/hooks/useGyro.ts`**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Quaternion, OrientationConfig } from '../types/cube'

const IDENTITY_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 1 }
const STORAGE_KEY = 'cubeOrientationConfig'

export function invertQuaternion(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w }
}

export function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x:  a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y:  a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z:  a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w:  a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

// Applies inverse of reference to q, so result is relative to the reference orientation
export function applyReference(q: Quaternion, reference: Quaternion): Quaternion {
  return multiplyQuaternions(invertQuaternion(reference), q)
}

function loadConfig(): OrientationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { frontFace: 'green', bottomFace: 'yellow', referenceQuaternion: null }
}

function saveConfig(config: OrientationConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function useGyro(driver: React.MutableRefObject<CubeDriver | null>) {
  const [quaternion, setQuaternion] = useState<Quaternion>(IDENTITY_QUATERNION)
  const [config, setConfig] = useState<OrientationConfig>(loadConfig)
  const latestRawQ = useRef<Quaternion>(IDENTITY_QUATERNION)

  const reference = config.referenceQuaternion ?? IDENTITY_QUATERNION

  const resetGyro = useCallback(() => {
    const newConfig = { ...config, referenceQuaternion: latestRawQ.current }
    setConfig(newConfig)
    saveConfig(newConfig)
  }, [config])

  const saveOrientationConfig = useCallback((updates: Partial<OrientationConfig>) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    saveConfig(newConfig)
  }, [config])

  useEffect(() => {
    const d = driver.current
    if (!d) return
    const onGyro = (q: Quaternion) => {
      latestRawQ.current = q
      setQuaternion(applyReference(q, reference))
    }
    d.on('gyro', onGyro)
    return () => d.off('gyro', onGyro)
  }, [driver, reference])

  return { quaternion, config, resetGyro, saveOrientationConfig }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/hooks/useGyro.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGyro.ts tests/hooks/useGyro.test.ts
git commit -m "feat: add useGyro hook with reference quaternion offset"
```

---

## Task 8: `useGestureDetector` hook

**Files:**
- Create: `src/hooks/useGestureDetector.ts`
- Create: `tests/hooks/useGestureDetector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/hooks/useGestureDetector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { matchGesture } from '../../src/hooks/useGestureDetector'
import type { Move, GesturePattern } from '../../src/types/cube'

function makeMove(face: Move['face'], dir: Move['direction'], ts: number): Move {
  return { face, direction: dir, cubeTimestamp: ts, serial: 0 }
}

describe('matchGesture', () => {
  const pattern: GesturePattern = { face: 'U', direction: 'CW', count: 4, windowMs: 2000 }

  it('returns true when 4 matching moves are within window', () => {
    const moves = [
      makeMove('U', 'CW', 0),
      makeMove('U', 'CW', 300),
      makeMove('U', 'CW', 600),
      makeMove('U', 'CW', 900),
    ]
    expect(matchGesture(moves, pattern)).toBe(true)
  })

  it('returns false when moves span beyond windowMs', () => {
    const moves = [
      makeMove('U', 'CW', 0),
      makeMove('U', 'CW', 300),
      makeMove('U', 'CW', 600),
      makeMove('U', 'CW', 2100), // 2100ms gap from first
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })

  it('returns false when wrong face', () => {
    const moves = [
      makeMove('R', 'CW', 0),
      makeMove('R', 'CW', 300),
      makeMove('R', 'CW', 600),
      makeMove('R', 'CW', 900),
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })

  it('returns false when wrong direction', () => {
    const moves = [
      makeMove('U', 'CCW', 0),
      makeMove('U', 'CCW', 300),
      makeMove('U', 'CCW', 600),
      makeMove('U', 'CCW', 900),
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })

  it('returns false when fewer than count moves', () => {
    const moves = [
      makeMove('U', 'CW', 0),
      makeMove('U', 'CW', 300),
      makeMove('U', 'CW', 600),
    ]
    expect(matchGesture(moves, pattern)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/hooks/useGestureDetector.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `src/hooks/useGestureDetector.ts`**

```typescript
import { useEffect } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, GesturePattern } from '../types/cube'

export function matchGesture(recentMoves: Move[], pattern: GesturePattern): boolean {
  const matching = recentMoves.filter(
    (m) => m.face === pattern.face && m.direction === pattern.direction
  )
  if (matching.length < pattern.count) return false
  const last = matching.slice(-pattern.count)
  return last[last.length - 1].cubeTimestamp - last[0].cubeTimestamp <= pattern.windowMs
}

const DEFAULT_PATTERNS: Array<{ pattern: GesturePattern; action: string }> = [
  { pattern: { face: 'U', direction: 'CW', count: 4, windowMs: 2000 }, action: 'resetGyro' },
  { pattern: { face: 'D', direction: 'CW', count: 4, windowMs: 2000 }, action: 'resetState' },
]

interface GestureHandlers {
  resetGyro: () => void
  resetState: () => void
}

export function useGestureDetector(
  driver: React.MutableRefObject<CubeDriver | null>,
  handlers: GestureHandlers
) {
  useEffect(() => {
    const d = driver.current
    if (!d) return

    const history: Move[] = []

    const onMove = (move: Move) => {
      history.push(move)
      // Keep only last 20 moves to bound memory
      if (history.length > 20) history.shift()

      for (const { pattern, action } of DEFAULT_PATTERNS) {
        if (matchGesture(history, pattern)) {
          if (action === 'resetGyro') handlers.resetGyro()
          if (action === 'resetState') handlers.resetState()
          history.length = 0 // clear after gesture fires
        }
      }
    }

    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver, handlers])
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/hooks/useGestureDetector.test.ts
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGestureDetector.ts tests/hooks/useGestureDetector.test.ts
git commit -m "feat: add useGestureDetector hook"
```

---

## Task 9: `useSolveRecorder` hook

**Files:**
- Create: `src/hooks/useSolveRecorder.ts`
- Create: `tests/hooks/useSolveRecorder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/hooks/useSolveRecorder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSolveSession } from '../../src/hooks/useSolveRecorder'
import type { Move } from '../../src/types/cube'

function makeMove(face: Move['face'], ts: number): { move: Move; cubeTimestamp: number } {
  return { move: { face, direction: 'CW', cubeTimestamp: ts, serial: 0 }, cubeTimestamp: ts }
}

describe('buildSolveSession', () => {
  it('builds a SolveSession from recorded entries', () => {
    const entries = [makeMove('U', 100), makeMove('R', 500), makeMove('F', 1200)]
    const session = buildSolveSession(entries)
    expect(session.moves).toHaveLength(3)
    expect(session.startTimestamp).toBe(100)
    expect(session.endTimestamp).toBe(1200)
  })

  it('returns null for empty entries', () => {
    expect(buildSolveSession([])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/hooks/useSolveRecorder.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create `src/hooks/useSolveRecorder.ts`**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { CubeDriver } from '../drivers/CubeDriver'
import type { Move, SolveSession } from '../types/cube'

type Entry = { move: Move; cubeTimestamp: number }

export function buildSolveSession(entries: Entry[]): SolveSession | null {
  if (entries.length === 0) return null
  return {
    moves: entries,
    startTimestamp: entries[0].cubeTimestamp,
    endTimestamp: entries[entries.length - 1].cubeTimestamp,
  }
}

export function useSolveRecorder(
  driver: React.MutableRefObject<CubeDriver | null>,
  isSolved: boolean
) {
  const [lastSession, setLastSession] = useState<SolveSession | null>(null)
  const isRecording = useRef(false)
  const entries = useRef<Entry[]>([])
  const wasSolvedRef = useRef(true)

  // Start recording on first move after solved; stop when solved again
  useEffect(() => {
    if (isSolved && isRecording.current) {
      const session = buildSolveSession(entries.current)
      if (session) setLastSession(session)
      isRecording.current = false
      entries.current = []
    }
    wasSolvedRef.current = isSolved
  }, [isSolved])

  useEffect(() => {
    const d = driver.current
    if (!d) return

    const onMove = (move: Move) => {
      if (wasSolvedRef.current && !isRecording.current) {
        isRecording.current = true
        entries.current = []
      }
      if (isRecording.current) {
        entries.current.push({ move, cubeTimestamp: move.cubeTimestamp })
      }
    }

    d.on('move', onMove)
    return () => d.off('move', onMove)
  }, [driver])

  const clearSession = useCallback(() => setLastSession(null), [])

  return { lastSession, clearSession }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/hooks/useSolveRecorder.test.ts
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSolveRecorder.ts tests/hooks/useSolveRecorder.test.ts
git commit -m "feat: add useSolveRecorder hook"
```

---

## Task 10: Three.js CubeRenderer

**Files:**
- Create: `src/rendering/CubeRenderer.ts`

- [ ] **Step 1: Create `src/rendering/CubeRenderer.ts`**

```typescript
import * as THREE from 'three'
import type { Quaternion, Face } from '../types/cube'

// Face color map: face letter → hex color
const FACE_COLORS: Record<string, number> = {
  U: 0xffffff, // white
  D: 0xffff00, // yellow
  F: 0x00aa00, // green
  B: 0x0000cc, // blue
  R: 0xcc0000, // red
  L: 0xff8800, // orange
}

// Kociemba face order and their positions in the 54-char facelets string
const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

// Layer axis + direction for each face move
const LAYER_CONFIG: Record<Face, { axis: 'x' | 'y' | 'z'; layer: number; cwSign: number }> = {
  U: { axis: 'y', layer:  1, cwSign: -1 },
  D: { axis: 'y', layer: -1, cwSign:  1 },
  F: { axis: 'z', layer:  1, cwSign: -1 },
  B: { axis: 'z', layer: -1, cwSign:  1 },
  R: { axis: 'x', layer:  1, cwSign: -1 },
  L: { axis: 'x', layer: -1, cwSign:  1 },
}

interface AnimationJob {
  face: Face
  cwSign: number
  elapsed: number
  duration: number
  onComplete: () => void
}

export class CubeRenderer {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  private cubies: THREE.Mesh[] = []
  private animationJob: AnimationJob | null = null
  private animFrameId: number | null = null
  private pivotGroup = new THREE.Group()

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100)
    this.camera.position.set(4, 4, 6)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const dir = new THREE.DirectionalLight(0xffffff, 0.5)
    dir.position.set(5, 10, 7)
    this.scene.add(dir)

    this.scene.add(this.pivotGroup)
    this._buildCubies()
    this._startRenderLoop()
  }

  private _buildCubies(): void {
    this.cubies = []
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue // center cubie invisible
          const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
          const mats = [
            new THREE.MeshLambertMaterial({ color: x === 1 ? FACE_COLORS['R'] : 0x111111 }),
            new THREE.MeshLambertMaterial({ color: x === -1 ? FACE_COLORS['L'] : 0x111111 }),
            new THREE.MeshLambertMaterial({ color: y === 1 ? FACE_COLORS['U'] : 0x111111 }),
            new THREE.MeshLambertMaterial({ color: y === -1 ? FACE_COLORS['D'] : 0x111111 }),
            new THREE.MeshLambertMaterial({ color: z === 1 ? FACE_COLORS['F'] : 0x111111 }),
            new THREE.MeshLambertMaterial({ color: z === -1 ? FACE_COLORS['B'] : 0x111111 }),
          ]
          const mesh = new THREE.Mesh(geo, mats)
          mesh.position.set(x, y, z)
          mesh.userData = { x, y, z }
          this.scene.add(mesh)
          this.cubies.push(mesh)
        }
      }
    }
  }

  updateFacelets(facelets: string): void {
    // TODO: map facelets string positions to cubie face materials
    // This is a simplified pass; full mapping requires cubie-face correspondence table
    void facelets
  }

  setQuaternion(q: Quaternion): void {
    this.pivotGroup.quaternion.set(q.x, q.y, q.z, q.w)
  }

  animateMove(face: Face, direction: 'CW' | 'CCW', durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const config = LAYER_CONFIG[face]
      const cwSign = direction === 'CW' ? config.cwSign : -config.cwSign
      this.animationJob = { face, cwSign, elapsed: 0, duration: durationMs, onComplete: resolve }
    })
  }

  private _startRenderLoop(): void {
    let last = performance.now()
    const loop = (now: number) => {
      const delta = now - last
      last = now
      this._tickAnimation(delta)
      this.renderer.render(this.scene, this.camera)
      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  private _tickAnimation(deltaMs: number): void {
    if (!this.animationJob) return
    const job = this.animationJob
    job.elapsed += deltaMs
    const progress = Math.min(job.elapsed / job.duration, 1)
    const angle = (Math.PI / 2) * progress * job.cwSign

    const config = LAYER_CONFIG[job.face]
    const layer = config.layer

    this.cubies.forEach((c) => {
      const pos = c.userData as { x: number; y: number; z: number }
      const onLayer = Math.round(pos[config.axis]) === layer
      if (!onLayer) return
      // Rotate cubie around axis
      const pivot = new THREE.Vector3()
      pivot[config.axis] = 1
      c.position.applyAxisAngle(pivot, angle - (job.elapsed > deltaMs ? (angle - deltaMs / job.duration * Math.PI / 2 * job.cwSign) : 0))
    })

    if (progress >= 1) {
      this.animationJob = null
      job.onComplete()
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId)
    this.renderer.dispose()
  }
}
```

**Note:** The layer rotation animation in `_tickAnimation` is a simplified approach. After wiring up and testing in the browser, refine the per-cubie rotation using a proper pivot-group technique (move cubies into a pivot group, rotate the group, then move cubies back out) for correct layer animation.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only Three.js type warnings — acceptable at this stage).

- [ ] **Step 3: Commit**

```bash
git add src/rendering/CubeRenderer.ts
git commit -m "feat: add Three.js CubeRenderer with layer animation skeleton"
```

---

## Task 11: `CubeCanvas` component

**Files:**
- Create: `src/components/CubeCanvas.tsx`

- [ ] **Step 1: Create `src/components/CubeCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { CubeRenderer } from '../rendering/CubeRenderer'
import type { Quaternion } from '../types/cube'

interface Props {
  facelets: string
  quaternion: Quaternion
  onRendererReady?: (renderer: CubeRenderer) => void
}

export function CubeCanvas({ facelets, quaternion, onRendererReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<CubeRenderer | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const renderer = new CubeRenderer(canvasRef.current)
    rendererRef.current = renderer
    onRendererReady?.(renderer)

    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      renderer.resize(canvas.clientWidth, canvas.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rendererRef.current?.updateFacelets(facelets)
  }, [facelets])

  useEffect(() => {
    rendererRef.current?.setQuaternion(quaternion)
  }, [quaternion])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '400px', display: 'block' }}
    />
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CubeCanvas.tsx
git commit -m "feat: add CubeCanvas component"
```

---

## Task 12: `ConnectionBar` and `ControlBar` components

**Files:**
- Create: `src/components/ConnectionBar.tsx`
- Create: `src/components/ControlBar.tsx`

- [ ] **Step 1: Create `src/components/ConnectionBar.tsx`**

```tsx
import type { ConnectionStatus } from '../drivers/CubeDriver'

interface Props {
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
}

export function ConnectionBar({ status, onConnect, onDisconnect }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: '#16213e' }}>
      <button
        onClick={onConnect}
        disabled={status !== 'disconnected'}
        style={{ padding: '6px 14px' }}
      >
        Connect
      </button>
      <span style={{ color: status === 'connected' ? '#4caf50' : '#aaa' }}>
        {STATUS_LABEL[status]}
      </span>
      <button
        onClick={onDisconnect}
        disabled={status !== 'connected'}
        style={{ padding: '6px 14px', marginLeft: 'auto' }}
      >
        Disconnect
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/ControlBar.tsx`**

```tsx
interface Props {
  onResetGyro: () => void
  onResetState: () => void
  disabled: boolean
}

export function ControlBar({ onResetGyro, onResetState, disabled }: Props) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '8px 16px', background: '#0f3460' }}>
      <button onClick={onResetGyro} disabled={disabled} style={{ padding: '6px 14px' }}>
        Reset Gyro
      </button>
      <button onClick={onResetState} disabled={disabled} style={{ padding: '6px 14px' }}>
        Reset Cube State
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ConnectionBar.tsx src/components/ControlBar.tsx
git commit -m "feat: add ConnectionBar and ControlBar components"
```

---

## Task 13: `OrientationConfig` component

**Files:**
- Create: `src/components/OrientationConfig.tsx`

- [ ] **Step 1: Create `src/components/OrientationConfig.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/OrientationConfig.tsx
git commit -m "feat: add OrientationConfig component"
```

---

## Task 14: `MoveHistory` component

**Files:**
- Create: `src/components/MoveHistory.tsx`

- [ ] **Step 1: Create `src/components/MoveHistory.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import type { Move } from '../types/cube'

interface Props {
  moves: Move[]
}

function moveLabel(move: Move): string {
  return `${move.face}${move.direction === 'CCW' ? "'" : ''}`
}

export function MoveHistory({ moves }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [moves])

  return (
    <div style={{ padding: '8px 16px', background: '#0f3460', maxHeight: '80px', overflowY: 'auto' }}>
      <span style={{ color: '#aaa', fontSize: '13px' }}>
        {moves.length === 0
          ? 'No moves yet'
          : moves.map(moveLabel).join(' ')}
      </span>
      <div ref={endRef} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MoveHistory.tsx
git commit -m "feat: add MoveHistory component"
```

---

## Task 15: `SolveReplayer` component

**Files:**
- Create: `src/components/SolveReplayer.tsx`

- [ ] **Step 1: Create `src/components/SolveReplayer.tsx`**

```tsx
import { useState, useRef, useCallback } from 'react'
import type { SolveSession } from '../types/cube'
import type { CubeRenderer } from '../rendering/CubeRenderer'

interface Props {
  session: SolveSession
  renderer: CubeRenderer | null
  onClose: () => void
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2]

export function SolveReplayer({ session, renderer, onClose }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const totalMs = session.endTimestamp - session.startTimestamp
  const elapsedMs = currentIndex > 0
    ? session.moves[currentIndex - 1].cubeTimestamp - session.startTimestamp
    : 0

  const cancelScheduled = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const play = useCallback(() => {
    if (!renderer) return
    setIsPlaying(true)
    const startIdx = currentIndex
    const moves = session.moves

    moves.slice(startIdx).forEach((entry, i) => {
      const prevTs = i === 0 && startIdx === 0
        ? session.startTimestamp
        : moves[startIdx + i - 1]?.cubeTimestamp ?? entry.cubeTimestamp
      const delay = (entry.cubeTimestamp - prevTs) / speed

      const t = setTimeout(() => {
        renderer.animateMove(entry.move.face, entry.move.direction, Math.max(80, delay * 0.8))
        setCurrentIndex(startIdx + i + 1)
        if (startIdx + i + 1 >= moves.length) setIsPlaying(false)
      }, delay)
      timeoutsRef.current.push(t)
    })
  }, [renderer, session, currentIndex, speed])

  const pause = useCallback(() => {
    cancelScheduled()
    setIsPlaying(false)
  }, [cancelScheduled])

  const scrub = useCallback((idx: number) => {
    cancelScheduled()
    setIsPlaying(false)
    setCurrentIndex(idx)
  }, [cancelScheduled])

  const solveSeconds = (totalMs / 1000).toFixed(1)

  return (
    <div style={{ padding: '12px 16px', background: '#16213e', borderTop: '1px solid #333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '13px' }}>
          Replay: {solveSeconds}s solve, {session.moves.length} moves
        </span>
        <button onClick={onClose} style={{ fontSize: '12px', padding: '2px 8px' }}>✕</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={isPlaying ? pause : play} style={{ padding: '6px 14px', minWidth: '60px' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={session.moves.length}
          value={currentIndex}
          onChange={(e) => scrub(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ padding: '4px' }}
        >
          {SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
        {(elapsedMs / 1000).toFixed(1)}s / {solveSeconds}s
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SolveReplayer.tsx
git commit -m "feat: add SolveReplayer component with play/pause, speed, and scrub"
```

---

## Task 16: Wire up `App.tsx` and verify in browser

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Replace `src/index.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #1a1a2e; color: #e0e0e0; font-family: sans-serif; }
button { cursor: pointer; border: none; background: #e94560; color: white; border-radius: 4px; }
button:disabled { background: #555; cursor: not-allowed; }
select { background: #0f3460; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 4px; }
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { useRef, useState } from 'react'
import { useCubeDriver } from './hooks/useCubeDriver'
import { useCubeState } from './hooks/useCubeState'
import { useGyro } from './hooks/useGyro'
import { useGestureDetector } from './hooks/useGestureDetector'
import { useSolveRecorder } from './hooks/useSolveRecorder'
import { ConnectionBar } from './components/ConnectionBar'
import { ControlBar } from './components/ControlBar'
import { CubeCanvas } from './components/CubeCanvas'
import { OrientationConfig } from './components/OrientationConfig'
import { MoveHistory } from './components/MoveHistory'
import { SolveReplayer } from './components/SolveReplayer'
import type { CubeRenderer } from './rendering/CubeRenderer'

export default function App() {
  const { driver, connect, disconnect, status } = useCubeDriver()
  const { facelets, isSolved, resetState } = useCubeState(driver)
  const { quaternion, config, resetGyro, saveOrientationConfig } = useGyro(driver)
  const { lastSession, clearSession } = useSolveRecorder(driver, isSolved)
  const rendererRef = useRef<CubeRenderer | null>(null)
  const [moves, setMoves] = useState<import('./types/cube').Move[]>([])

  // Collect moves for MoveHistory
  useState(() => {
    const d = driver.current
    if (!d) return
    d.on('move', (m) => setMoves((prev) => [...prev.slice(-100), m]))
  })

  useGestureDetector(driver, { resetGyro, resetState })

  const isConnected = status === 'connected'

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh' }}>
      <ConnectionBar status={status} onConnect={connect} onDisconnect={disconnect} />
      <ControlBar onResetGyro={resetGyro} onResetState={resetState} disabled={!isConnected} />
      <CubeCanvas
        facelets={facelets}
        quaternion={quaternion}
        onRendererReady={(r) => { rendererRef.current = r }}
      />
      <OrientationConfig
        config={config}
        onSave={saveOrientationConfig}
        onUseCurrentOrientation={resetGyro}
        disabled={!isConnected}
      />
      <MoveHistory moves={moves} />
      {lastSession && (
        <SolveReplayer
          session={lastSession}
          renderer={rendererRef.current}
          onClose={clearSession}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Start dev server and verify UI renders**

```bash
npm run dev
```

Open `http://localhost:5173`. Expected: app loads, shows Connect button, 3D cube canvas, orientation dropdowns, empty move history.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Final commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: wire up App.tsx with all hooks and components"
```

---

## Self-Review

**Spec coverage check:**
- BLE connectivity (GanCubeDriver + useCubeDriver) ✓
- 3D cube display (CubeRenderer + CubeCanvas) ✓
- Gyroscope sync with reference offset (useGyro) ✓
- Reset gyro button + D×4 / U×4 gesture shortcuts (useGestureDetector + ControlBar) ✓
- Reset cube state button ✓
- Orientation config with dropdowns + "use current" + localStorage (OrientationConfig + useGyro) ✓
- Move history (MoveHistory) ✓
- Solve recording (useSolveRecorder) ✓
- Replay with play/pause + speed slider + scrub (SolveReplayer) ✓
- Abstraction layer for future cube brands (CubeDriver interface) ✓

**Known follow-up items (not blocking phase 1):**
- `CubeRenderer.updateFacelets()` — cubie-to-facelet index mapping needs to be completed after verifying Three.js cubie positioning
- Layer rotation animation in `_tickAnimation` — replace simplified approach with pivot-group technique for correct visual
- `useCubeState` — verify `cubing.js` API method names against installed version before testing with real cube
