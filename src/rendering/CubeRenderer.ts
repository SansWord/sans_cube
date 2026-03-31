import * as THREE from 'three'
import type { Quaternion, Face } from '../types/cube'

const FACE_COLORS: Record<string, number> = {
  U: 0xffffff, D: 0xffff00, F: 0x00aa00,
  B: 0x0000cc, R: 0xcc0000, L: 0xff8800,
}

const LAYER_AXIS: Record<Face, 'x' | 'y' | 'z'> = {
  U: 'y', D: 'y', F: 'z', B: 'z', R: 'x', L: 'x',
}
const LAYER_VALUE: Record<Face, number> = {
  U: 1, D: -1, F: 1, B: -1, R: 1, L: -1,
}
// Rotation angle for CW move (in radians)
const LAYER_CW_ANGLE: Record<Face, number> = {
  U: -Math.PI / 2, D: Math.PI / 2,
  F: -Math.PI / 2, B: Math.PI / 2,
  R: -Math.PI / 2, L: Math.PI / 2,
}

export class CubeRenderer {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  private cubies: THREE.Mesh[] = []
  private pivotGroup = new THREE.Group()
  // Separate frame IDs: renderFrameId is always running; animFrameId is only set during an animation tick
  private renderFrameId: number | null = null
  private animFrameId: number | null = null
  private animationQueue: Array<() => Promise<void>> = []
  private animationRunning = false

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
          if (x === 0 && y === 0 && z === 0) continue
          const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
          // Material order: [+X=R, -X=L, +Y=U, -Y=D, +Z=F, -Z=B]
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
          this.pivotGroup.add(mesh)
          this.cubies.push(mesh)
        }
      }
    }
  }

  updateFacelets(facelets: string): void {
    const colorMap = (ch: string): number => FACE_COLORS[ch] ?? 0x111111

    this.cubies.forEach(cubie => {
      const { x, y, z } = cubie.userData as { x: number; y: number; z: number }
      const mats = cubie.material as THREE.MeshLambertMaterial[]

      // +X face (R): x===1, y from 1→-1 (top-bottom), z from -1→1 (left-right)
      if (x === 1) {
        const row = 1 - y  // y=1→row=0, y=0→row=1, y=-1→row=2
        const col = z + 1  // z=-1→col=0, z=0→col=1, z=1→col=2
        mats[0].color.setHex(colorMap(facelets[9 + row * 3 + col]))
      }
      // -X face (L): x===-1, y from 1→-1, z from 1→-1
      if (x === -1) {
        const row = 1 - y
        const col = 1 - z  // z=1→col=0, z=0→col=1, z=-1→col=2
        mats[1].color.setHex(colorMap(facelets[36 + row * 3 + col]))
      }
      // +Y face (U): y===1, z from -1→1 (back to front), x from -1→1
      if (y === 1) {
        const row = z + 1  // z=-1→row=0, z=0→row=1, z=1→row=2
        const col = x + 1
        mats[2].color.setHex(colorMap(facelets[0 + row * 3 + col]))
      }
      // -Y face (D): y===-1, z from 1→-1, x from -1→1
      if (y === -1) {
        const row = 1 - z  // z=1→row=0, z=0→row=1, z=-1→row=2
        const col = x + 1
        mats[3].color.setHex(colorMap(facelets[27 + row * 3 + col]))
      }
      // +Z face (F): z===1, y from 1→-1, x from -1→1
      if (z === 1) {
        const row = 1 - y
        const col = x + 1
        mats[4].color.setHex(colorMap(facelets[18 + row * 3 + col]))
      }
      // -Z face (B): z===-1, y from 1→-1, x from 1→-1
      if (z === -1) {
        const row = 1 - y
        const col = 1 - x  // x=1→col=0, x=0→col=1, x=-1→col=2
        mats[5].color.setHex(colorMap(facelets[45 + row * 3 + col]))
      }
    })
  }

  // GAN coordinate system: +X=Red, +Y=Blue(back), +Z=White(top)
  // Three.js cube layout:   +X=Red, +Y=White(top), +Z=Green(front)
  // Conversion: rotate -90° around X  →  q_three = R * q_gan * R⁻¹
  private static readonly _GAN_TO_THREE = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2)

  setQuaternion(q: Quaternion): void {
    const R = CubeRenderer._GAN_TO_THREE
    const ganQ = new THREE.Quaternion(q.x, q.y, q.z, q.w)
    const converted = R.clone().multiply(ganQ).multiply(R.clone().invert())
    this.pivotGroup.quaternion.copy(converted)
  }

  queueFaceletsUpdate(facelets: string): void {
    this.animationQueue.push(() => {
      this.updateFacelets(facelets)
      return Promise.resolve()
    })
    if (!this.animationRunning) this._drainAnimationQueue()
  }

  animateMove(face: Face, direction: 'CW' | 'CCW', durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.animationQueue.push(() => this._runMoveAnimation(face, direction, durationMs).then(resolve))
      if (!this.animationRunning) this._drainAnimationQueue()
    })
  }

  private _drainAnimationQueue(): void {
    if (this.animationQueue.length === 0) {
      this.animationRunning = false
      return
    }
    this.animationRunning = true
    const next = this.animationQueue.shift()!
    next().then(() => this._drainAnimationQueue())
  }

  private _runMoveAnimation(face: Face, direction: 'CW' | 'CCW', durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const axis = LAYER_AXIS[face]
      const layerVal = LAYER_VALUE[face]
      const cwAngle = LAYER_CW_ANGLE[face]
      const totalAngle = direction === 'CW' ? cwAngle : -cwAngle

      const pivot = new THREE.Group()
      this.pivotGroup.add(pivot)
      const moving: THREE.Mesh[] = []

      this.cubies.forEach(c => {
        const pos = c.userData as { x: number; y: number; z: number }
        if (Math.round(pos[axis]) === layerVal) {
          moving.push(c)
          pivot.attach(c)
        }
      })

      const start = performance.now()

      const tick = () => {
        const elapsed = performance.now() - start
        const t = Math.min(elapsed / durationMs, 1)
        const angle = totalAngle * t

        pivot.rotation.set(0, 0, 0)
        if (axis === 'x') pivot.rotation.x = angle
        else if (axis === 'y') pivot.rotation.y = angle
        else pivot.rotation.z = angle

        if (t >= 1) {
          pivot.rotation.set(
            axis === 'x' ? totalAngle : 0,
            axis === 'y' ? totalAngle : 0,
            axis === 'z' ? totalAngle : 0,
          )
          pivot.updateMatrixWorld()
          moving.forEach(c => {
            this.pivotGroup.attach(c)
            c.position.x = Math.round(c.position.x)
            c.position.y = Math.round(c.position.y)
            c.position.z = Math.round(c.position.z)
            const ud = c.userData as { x: number; y: number; z: number }
            ud.x = c.position.x
            ud.y = c.position.y
            ud.z = c.position.z
          })
          this.pivotGroup.remove(pivot)
          this.animFrameId = null
          resolve()
          return
        }

        this.animFrameId = requestAnimationFrame(tick)
      }

      this.animFrameId = requestAnimationFrame(tick)
    })
  }

  private _startRenderLoop(): void {
    const loop = () => {
      this.renderer.render(this.scene, this.camera)
      this.renderFrameId = requestAnimationFrame(loop)
    }
    this.renderFrameId = requestAnimationFrame(loop)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose(): void {
    this.animationQueue = []
    this.animationRunning = false
    if (this.renderFrameId !== null) cancelAnimationFrame(this.renderFrameId)
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId)
    this.renderer.dispose()
  }
}
