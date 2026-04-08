# Animation System

## Overview

The 3D cube animation has three independent systems that run simultaneously during replay:

1. **Move animation** — rotates a layer of cubies in Three.js
2. **Gyro animation** — sets the overall cube orientation from recorded quaternion snapshots
3. **Orbit** — user-controlled viewing angle, independent of gyro/move state

Move and gyro must be coordinated to avoid visual conflicts (see [Gyro/Move Conflict](#gyromove-conflict) below).

---

## Move Animation

### Entry point

`CubeRenderer.animateMove(face, direction, durationMs)` — queues a layer rotation. All moves (including M/E/S slices) go through this path.

### Animation queue

Moves and facelet updates share a single queue (`animationQueue`). Only one item runs at a time. If the queue has more than one pending move, subsequent moves snap instantly (`effectiveDuration = 0`) to avoid falling behind live playback.

### Layer selection

Each face/slice maps to an axis, a layer coordinate, and a CW rotation angle:

| Face | Axis | Layer value | CW angle | Notes |
|------|------|-------------|----------|-------|
| R    | x    | +1          | −π/2     | |
| L    | x    | −1          | +π/2     | |
| U    | y    | +1          | −π/2     | |
| D    | y    | −1          | +π/2     | |
| F    | z    | +1          | −π/2     | |
| B    | z    | −1          | +π/2     | |
| M    | x    |  0          | +π/2     | follows L |
| E    | y    |  0          | +π/2     | follows D |
| S    | z    |  0          | −π/2     | follows F |

Selection predicate: `Math.round(cubie.userData[axis]) === layerValue`. Rounding handles floating-point drift from previous animations.

### Scene graph

```
scene
└── orbitGroup        ← user drag (viewing angle)
    └── pivotGroup    ← gyro / cube orientation
        ├── cubie mesh × 26
        └── pivot (temporary, exists only during layer animation)
```

### Animation mechanics

1. A temporary `pivot` Group is added as a child of `pivotGroup`.
2. Cubies in the target layer are reparented to `pivot` via `pivot.attach(c)` (preserves world transform).
3. Each frame, `pivot.rotation[axis]` is set to `totalAngle * t` where `t ∈ [0,1]`.
4. On completion, cubies are reparented back to `pivotGroup` via `pivotGroup.attach(c)`, positions are rounded to integers, and `userData` is updated.
5. `_syncMaterialVisibility` runs to show/hide stickers based on new positions.

### Facelets update timing

`queueFaceletsUpdate` is called when the `facelets` React prop changes (triggered by `setCurrentIndex` in the replay loop). Since it shares the same queue as move animations, the texture update always fires **after** the layer rotation completes — the stickers show the pre-move colors during the animation and update to post-move colors immediately after.

---

## Gyro Animation

During replay, `useReplayController` runs a `requestAnimationFrame` loop that:

1. Computes `solveElapsed` (solve time at current playback position).
2. Calls `findSlerpedQuaternion(snapshots, solveElapsed)` — binary-searches the 10 Hz snapshot array and SLERPs between the two nearest samples.
3. Calls `renderer.setQuaternion(q)` — converts from GAN sensor space to Three.js space and sets `pivotGroup.quaternion` directly. `orbitGroup.quaternion` (user orbit offset) is unaffected.

Quaternion snapshots are recorded at **10 Hz** during a live solve (`useTimer`, 100 ms cap). The 60 Hz replay loop interpolates between them, so orientation appears smooth.

---

## Gyro/Move Conflict

### The problem

The GAN gyro is embedded in the cube chassis (outer layers). During M/E/S slice moves, the solver's hands cause the outer layers to counter-rotate slightly — typically **~4.5°** per M move. This is recorded in the quaternion snapshots.

During replay, the gyro loop runs every frame, so `setQuaternion` fires during the 150 ms move animation. This made the **whole cube visibly rotate** while the slice was also animating.

### The fix (`useReplayController`)

The gyro loop checks `renderer.isAnimating` each frame and coordinates in three states:

| State | Behavior |
|-------|----------|
| `isAnimating = true` | Skip `setQuaternion` — freeze orientation |
| Just transitioned to `false` | Call `animateQuaternionTo(q, 120ms)` — smooth settle to correct orientation; block normal updates for 120 ms |
| Normal (no animation, settle done) | `setQuaternion(q)` as usual |

The 120 ms smooth settle prevents the 4.5° accumulated drift from appearing as a visible snap when the move animation ends.

`renderer.isAnimating` exposes the private `animationRunning` flag, which is `true` for the entire duration of any queued animation (move or facelets).

---

## Orbit

`applyOrbitDelta(dx, dy)` rotates `orbitGroup.quaternion` in response to user drag. Because `orbitGroup` is the parent of `pivotGroup` in the scene graph, the two compose naturally — the user sees gyro orientation from their chosen viewing angle.

`setQuaternion` writes only to `pivotGroup`, so gyro updates during replay never overwrite the orbit offset. `resetOrientation()` zeroes `orbitGroup.quaternion`, restoring the default view without affecting gyro state.

`determineMoveFromDrag` uses `pivotGroup.getWorldQuaternion()` (which includes both orbit and gyro) to correctly map screen drag to cube-local space regardless of viewing angle.

---

## Coordinate Systems

The GAN sensor and Three.js use different coordinate conventions:

- **GAN**: +X = Red face, +Y = Blue (back), +Z = White (top)
- **Three.js cube**: +X = Red face, +Y = White (top), +Z = Green (front)

Conversion: rotate −90° around X → `q_three = R * q_gan * R⁻¹`  
where `R = Quaternion(-√½, 0, 0, √½)` (see `CubeRenderer._GAN_TO_THREE`).
