import * as THREE from 'three'
import type { Quaternion, Face } from '../types/cube'

const BG_COLOR = 0x2d3250

const FACE_COLORS: Record<string, number> = {
  U: 0xe8e8e8, D: 0xeec030, F: 0x50c050,
  B: 0x4878d0, R: 0xcc3838, L: 0xe89030,
}

function makeStickerTexture(color: number): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const bgR = (BG_COLOR >> 16) & 0xff
  const bgG = (BG_COLOR >> 8) & 0xff
  const bgB = BG_COLOR & 0xff
  ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`
  ctx.fillRect(0, 0, size, size)

  const cR = (color >> 16) & 0xff
  const cG = (color >> 8) & 0xff
  const cB = color & 0xff
  ctx.fillStyle = `rgb(${cR},${cG},${cB})`
  const pad = 10
  const r = 18
  const x = pad, y = pad, w = size - pad * 2, h = size - pad * 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()

  return new THREE.CanvasTexture(canvas)
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
  private readonly stickerTextures: Map<string, THREE.CanvasTexture>
  private pivotGroup = new THREE.Group()
  // Separate frame IDs: renderFrameId is always running; animFrameId is only set during an animation tick
  private renderFrameId: number | null = null
  private animFrameId: number | null = null
  private animationQueue: Array<
    | { type: 'move'; face: Face; direction: 'CW' | 'CCW'; durationMs: number; resolve: () => void }
    | { type: 'facelets'; facelets: string }
  > = []
  private animationRunning = false

  constructor(canvas: HTMLCanvasElement) {
    this.stickerTextures = new Map(
      Object.entries(FACE_COLORS).map(([face, color]) => [face, makeStickerTexture(color)])
    )

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(BG_COLOR)

    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100)
    this.camera.position.set(0, 6, 7)
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
          const face = (faceKey: string, outer: boolean) =>
            new THREE.MeshLambertMaterial({
              map: outer ? (this.stickerTextures.get(faceKey) ?? null) : null,
              color: 0xffffff,
              visible: outer,
            })
          const mats = [
            face('R', x === 1),
            face('L', x === -1),
            face('U', y === 1),
            face('D', y === -1),
            face('F', z === 1),
            face('B', z === -1),
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

  private _syncMaterialVisibility(): void {
    this.cubies.forEach(cubie => {
      const { x, y, z } = cubie.userData as { x: number; y: number; z: number }
      const mats = cubie.material as THREE.MeshLambertMaterial[]
      mats[0].visible = x === 1
      mats[1].visible = x === -1
      mats[2].visible = y === 1
      mats[3].visible = y === -1
      mats[4].visible = z === 1
      mats[5].visible = z === -1
    })
  }

  updateFacelets(facelets: string): void {
    const texFor = (ch: string) => this.stickerTextures.get(ch) ?? this.stickerTextures.get('U')!

    const setTex = (mat: THREE.MeshLambertMaterial, ch: string) => {
      mat.map = texFor(ch)
      mat.needsUpdate = true
    }

    this.cubies.forEach(cubie => {
      const { x, y, z } = cubie.userData as { x: number; y: number; z: number }
      const mats = cubie.material as THREE.MeshLambertMaterial[]

      if (x === 1) {
        const row = 1 - y; const col = 1 - z
        setTex(mats[0], facelets[9 + row * 3 + col])
      }
      if (x === -1) {
        const row = 1 - y; const col = z + 1
        setTex(mats[1], facelets[36 + row * 3 + col])
      }
      if (y === 1) {
        const row = z + 1; const col = x + 1
        setTex(mats[2], facelets[0 + row * 3 + col])
      }
      if (y === -1) {
        const row = 1 - z; const col = x + 1
        setTex(mats[3], facelets[27 + row * 3 + col])
      }
      if (z === 1) {
        const row = 1 - y; const col = x + 1
        setTex(mats[4], facelets[18 + row * 3 + col])
      }
      if (z === -1) {
        const row = 1 - y; const col = 1 - x
        setTex(mats[5], facelets[45 + row * 3 + col])
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
    this.animationQueue.push({ type: 'facelets', facelets })
    if (!this.animationRunning) this._drainAnimationQueue()
  }

  animateMove(face: Face, direction: 'CW' | 'CCW', durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.animationQueue.push({ type: 'move', face, direction, durationMs, resolve })
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

    if (next.type === 'facelets') {
      this.updateFacelets(next.facelets)
      this._drainAnimationQueue()
      return
    }

    // If queue is backed up, snap instead of animate so we don't fall behind
    const effectiveDuration = this.animationQueue.length > 1 ? 0 : next.durationMs
    this._runMoveAnimation(next.face, next.direction, effectiveDuration).then(() => {
      next.resolve()
      this._drainAnimationQueue()
    })
  }

  private _snapMove(face: Face, direction: 'CW' | 'CCW'): void {
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
      c.rotation.set(0, 0, 0)
      const ud = c.userData as { x: number; y: number; z: number }
      ud.x = c.position.x
      ud.y = c.position.y
      ud.z = c.position.z
    })
    this.pivotGroup.remove(pivot)
    this._syncMaterialVisibility()
  }

  private _runMoveAnimation(face: Face, direction: 'CW' | 'CCW', durationMs: number): Promise<void> {
    if (durationMs <= 0) {
      this._snapMove(face, direction)
      return Promise.resolve()
    }

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
            c.rotation.set(0, 0, 0)
            const ud = c.userData as { x: number; y: number; z: number }
            ud.x = c.position.x
            ud.y = c.position.y
            ud.z = c.position.z
          })
          this.pivotGroup.remove(pivot)
          this._syncMaterialVisibility()
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
    this.stickerTextures.forEach(t => t.dispose())
    this.renderer.dispose()
  }
}
