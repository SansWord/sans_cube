import * as THREE from 'three'
import type { Quaternion, Face, AnyFace } from '../types/cube'

interface CubieData { x: number; y: number; z: number }

export interface FaceHit {
  face: Face
  hitX: number   // world-space hit point
  hitY: number
  hitZ: number
  cubieX: number // cubie grid position (-1, 0, or 1 in local cube space)
  cubieY: number
  cubieZ: number
}

const BG_COLOR = 0x363c65

const FACE_COLORS: Record<string, number> = {
  W: 0xe8e8e8, Y: 0xf0d000, G: 0x50c050,
  B: 0x4878d0, R: 0xcc3838, O: 0xe06820,
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

const LAYER_AXIS: Record<AnyFace, 'x' | 'y' | 'z'> = {
  U: 'y', D: 'y', F: 'z', B: 'z', R: 'x', L: 'x',
  M: 'x', E: 'y', S: 'z',
  // x/y/z are whole-cube rotations; they are not animated as single layers
  x: 'x', y: 'y', z: 'z',
}
const LAYER_VALUE: Record<AnyFace, number> = {
  U: 1, D: -1, F: 1, B: -1, R: 1, L: -1,
  M: 0, E: 0, S: 0,
  x: 0, y: 0, z: 0,
}
// Rotation angle for CW move (in radians). Slice moves follow their outer-face partner:
// M follows L, E follows D, S follows F.
const LAYER_CW_ANGLE: Record<AnyFace, number> = {
  U: -Math.PI / 2, D: Math.PI / 2,
  F: -Math.PI / 2, B: Math.PI / 2,
  R: -Math.PI / 2, L: Math.PI / 2,
  M:  Math.PI / 2, E: Math.PI / 2, S: -Math.PI / 2,
  x: -Math.PI / 2, y: -Math.PI / 2, z: -Math.PI / 2,
}

export class CubeRenderer {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  private cubies: THREE.Mesh[] = []
  private readonly stickerTextures: Map<string, THREE.CanvasTexture>
  private orbitGroup = new THREE.Group()  // user-controlled viewing angle
  private pivotGroup = new THREE.Group()  // gyro / cube orientation
  // Separate frame IDs: renderFrameId is always running; animFrameId is only set during an animation tick
  private renderFrameId: number | null = null
  private animFrameId: number | null = null
  private quaternionAnimId: number | null = null
  private orbitAnimId: number | null = null
  private readonly cubieData = new WeakMap<THREE.Mesh, CubieData>()
  private animationQueue: Array<
    | { type: 'move'; face: AnyFace; direction: 'CW' | 'CCW'; durationMs: number; resolve: () => void }
    | { type: 'facelets'; facelets: string }
  > = []
  private animationRunning = false

  get isAnimating(): boolean { return this.animationRunning }

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

    this.orbitGroup.add(this.pivotGroup)
    this.scene.add(this.orbitGroup)
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
          this.cubieData.set(mesh, { x, y, z })
          this.pivotGroup.add(mesh)
          this.cubies.push(mesh)
        }
      }
    }
  }

  private _syncMaterialVisibility(): void {
    this.cubies.forEach(cubie => {
      const { x, y, z } = this.cubieData.get(cubie)!
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
    const texFor = (ch: string) => this.stickerTextures.get(ch) ?? this.stickerTextures.get('W')!

    const setTex = (mat: THREE.MeshLambertMaterial, ch: string) => {
      mat.map = texFor(ch)
      mat.needsUpdate = true
    }

    this.cubies.forEach(cubie => {
      const { x, y, z } = this.cubieData.get(cubie)!
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

  animateMove(face: AnyFace, direction: 'CW' | 'CCW', durationMs: number): Promise<void> {
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

  private _snapMove(face: AnyFace, direction: 'CW' | 'CCW'): void {
    const axis = LAYER_AXIS[face]
    const layerVal = LAYER_VALUE[face]
    const cwAngle = LAYER_CW_ANGLE[face]
    const totalAngle = direction === 'CW' ? cwAngle : -cwAngle

    const pivot = new THREE.Group()
    this.pivotGroup.add(pivot)
    const moving: THREE.Mesh[] = []

    this.cubies.forEach(c => {
      const pos = this.cubieData.get(c)!
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
      const ud = this.cubieData.get(c)!
      ud.x = c.position.x
      ud.y = c.position.y
      ud.z = c.position.z
    })
    this.pivotGroup.remove(pivot)
    this._syncMaterialVisibility()
  }

  private _runMoveAnimation(face: AnyFace, direction: 'CW' | 'CCW', durationMs: number): Promise<void> {
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
        const pos = this.cubieData.get(c)!
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
            const ud = this.cubieData.get(c)!
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

  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z)
    this.camera.lookAt(0, 0, 0)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  // Material index → Face name (BoxGeometry order: +X=R, -X=L, +Y=U, -Y=D, +Z=F, -Z=B)
  private static readonly _MAT_TO_FACE: Face[] = ['R', 'L', 'U', 'D', 'F', 'B']

  raycastFace(pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number): FaceHit | null {
    const ndcX = (pixelX / canvasWidth) * 2 - 1
    const ndcY = -(pixelY / canvasHeight) * 2 + 1
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const hits = raycaster.intersectObjects(this.cubies)
    if (hits.length === 0) return null
    const hit = hits[0]
    const faceIndex = hit.face?.materialIndex
    if (faceIndex === undefined || faceIndex === null) return null
    const face = CubeRenderer._MAT_TO_FACE[faceIndex]
    const { x: cubieX, y: cubieY, z: cubieZ } = this.cubieData.get(hit.object as THREE.Mesh)!
    return { face, hitX: hit.point.x, hitY: hit.point.y, hitZ: hit.point.z, cubieX, cubieY, cubieZ }
  }

  /**
   * Determine which face layer to rotate and in which direction from a drag gesture.
   *
   * Algorithm: ω = P_local × D_local (cross product of cubie grid position with local
   * drag direction). The sign of the dominant ω component determines the rotation axis
   * and direction, while the cubie's coordinate along that axis selects the layer face.
   */
  determineMoveFromDrag(hit: FaceHit, screenDx: number, screenDy: number): { face: Face; direction: 'CW' | 'CCW' } | null {
    this.camera.updateMatrixWorld()
    this.orbitGroup.updateMatrixWorld()

    // Camera basis in world space: right = col 0, up = col 1
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const cameraUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)

    // World-space drag vector (screen Y goes down, so negate cameraUp for screenDy)
    const worldDrag = cameraRight.clone().multiplyScalar(screenDx)
      .addScaledVector(cameraUp, -screenDy)

    // Transform to cube-local space by removing both orbit and gyro rotations
    const worldQ = new THREE.Quaternion()
    this.pivotGroup.getWorldQuaternion(worldQ)
    const invQ = worldQ.invert()
    const localDrag = worldDrag.applyQuaternion(invQ)

    // Determine face normal axis first
    const normalAxis: 'x' | 'y' | 'z' =
      hit.face === 'R' || hit.face === 'L' ? 'x' :
      hit.face === 'U' || hit.face === 'D' ? 'y' : 'z'

    // Project drag onto the face's tangent plane before the cross product.
    // The camera is tilted, so its "up" direction has a normal component that
    // would otherwise leak into the perpendicular axis and flip the layer pick.
    localDrag[normalAxis] = 0

    // Rotation tendency: ω = P × D (both in cube-local space)
    const P = new THREE.Vector3(hit.cubieX, hit.cubieY, hit.cubieZ)
    const omega = new THREE.Vector3().crossVectors(P, localDrag)
    omega[normalAxis] = 0  // discard remaining face-spin component

    let axis: 'x' | 'y' | 'z'
    const ox = Math.abs(omega.x), oy = Math.abs(omega.y), oz = Math.abs(omega.z)
    if (normalAxis === 'x')      axis = oy >= oz ? 'y' : 'z'
    else if (normalAxis === 'y') axis = ox >= oz ? 'x' : 'z'
    else                         axis = ox >= oy ? 'x' : 'y'

    // Layer is identified by the cubie's coordinate along the rotation axis
    const layerPos = axis === 'x' ? hit.cubieX : axis === 'y' ? hit.cubieY : hit.cubieZ
    if (layerPos === 0) return null  // middle slice — skip

    const faceByLayer: Record<string, Face> = {
      x1: 'R', 'x-1': 'L', y1: 'U', 'y-1': 'D', z1: 'F', 'z-1': 'B',
    }
    const face = faceByLayer[`${axis}${layerPos}`]

    // ω[axis] > 0 means positive rotation around that axis.
    // Positive rotation around +X/+Y/+Z = CCW for R/U/F (whose CW is -π/2) and CW for L/D/B (CW is +π/2).
    const omegaSign = omega[axis]
    const positiveMeansCCW = face === 'R' || face === 'U' || face === 'F'
    const direction: 'CW' | 'CCW' = (omegaSign > 0) === positiveMeansCCW ? 'CCW' : 'CW'

    return { face, direction }
  }

  resetOrientation(): void {
    this.orbitGroup.quaternion.identity()
  }

  animateQuaternionTo(q: { x: number; y: number; z: number; w: number }, durationMs: number): void {
    if (this.quaternionAnimId !== null) cancelAnimationFrame(this.quaternionAnimId)
    const R = CubeRenderer._GAN_TO_THREE
    const ganQ = new THREE.Quaternion(q.x, q.y, q.z, q.w)
    const target = R.clone().multiply(ganQ).multiply(R.clone().invert())
    const start = this.pivotGroup.quaternion.clone()
    const startTime = performance.now()
    const animate = () => {
      const t = Math.min((performance.now() - startTime) / durationMs, 1)
      this.pivotGroup.quaternion.slerpQuaternions(start, target, t)
      if (t < 1) {
        this.quaternionAnimId = requestAnimationFrame(animate)
      } else {
        this.quaternionAnimId = null
      }
    }
    this.quaternionAnimId = requestAnimationFrame(animate)
  }

  // Smoothly rotates orbit to a view that shows F, U, R over the given duration
  animateOrbitToDefaultView(durationMs = 400): void {
    if (this.orbitAnimId !== null) cancelAnimationFrame(this.orbitAnimId)
    const target = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 6)
    const start = this.orbitGroup.quaternion.clone()
    const startTime = performance.now()
    const animate = () => {
      const t = Math.min((performance.now() - startTime) / durationMs, 1)
      this.orbitGroup.quaternion.slerpQuaternions(start, target, t)
      if (t < 1) {
        this.orbitAnimId = requestAnimationFrame(animate)
      } else {
        this.orbitAnimId = null
      }
    }
    this.orbitAnimId = requestAnimationFrame(animate)
  }

  // Returns the current orbit quaternion converted to GAN sensor space,
  // so it can be emitted as a 'gyro' event and round-trip correctly through setQuaternion().
  // setQuaternion does: pivotQ = R * q_sensor * R^-1
  // Inverse:            q_sensor = R^-1 * pivotQ * R
  getOrbitQuaternionAsSensorSpace(): { x: number; y: number; z: number; w: number } {
    const R = CubeRenderer._GAN_TO_THREE
    const Rinv = R.clone().invert()
    const sensorQ = Rinv.clone().multiply(this.orbitGroup.quaternion).multiply(R.clone())
    return { x: sensorQ.x, y: sensorQ.y, z: sensorQ.z, w: sensorQ.w }
  }

  applyOrbitDelta(dx: number, dy: number): void {
    const sensitivity = 0.005
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * sensitivity)
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * sensitivity)
    this.orbitGroup.quaternion.premultiply(qY).premultiply(qX)
  }

  dispose(): void {
    this.animationQueue = []
    this.animationRunning = false
    if (this.renderFrameId !== null) cancelAnimationFrame(this.renderFrameId)
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId)
    if (this.quaternionAnimId !== null) cancelAnimationFrame(this.quaternionAnimId)
    if (this.orbitAnimId !== null) cancelAnimationFrame(this.orbitAnimId)
    this.stickerTextures.forEach(t => t.dispose())
    this.renderer.dispose()
  }
}
