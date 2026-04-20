import {
  FACE_CENTERS,
  OPPOSITE,
  FACE_POSITIONS,
  EDGES,
  CORNERS,
  type Edge,
  type Corner,
  edgesOnFace,
  cornersOnFace,
  findFaceWithColor,
} from './cubeGeometry'

// Cross: 4 edges around the Y-center face have Y on that face and adjacent
// stickers matching their face centers.
export function isCrossDone(f: string): boolean {
  const crossFace = findFaceWithColor(f, 'Y')
  if (crossFace === undefined) return false
  for (const [p1, c1, p2, c2] of edgesOnFace(crossFace)) {
    const [ownPos, adjPos, adjCenter] =
      c1 === crossFace ? [p1, p2, c2] : [p2, p1, c1]
    if (f[ownPos] !== 'Y') return false
    if (f[adjPos] !== f[adjCenter]) return false
  }
  return true
}

export function countCompletedF2LSlots(f: string): number {
  const dFace = findFaceWithColor(f, 'Y')
  if (dFace === undefined) return 0
  const opposite = OPPOSITE[dFace]
  const sideCenters = FACE_CENTERS.filter((c) => c !== dFace && c !== opposite)

  let count = 0
  for (let i = 0; i < sideCenters.length; i++) {
    for (let j = i + 1; j < sideCenters.length; j++) {
      const s1 = sideCenters[i]
      const s2 = sideCenters[j]
      if (OPPOSITE[s1] === s2) continue  // non-adjacent side pair

      const corner = CORNERS.find((c) => {
        const ctrs = c.map(([, ctr]) => ctr)
        return ctrs.includes(dFace) && ctrs.includes(s1) && ctrs.includes(s2)
      })
      const edge = EDGES.find(([, c1, , c2]) =>
        (c1 === s1 && c2 === s2) || (c1 === s2 && c2 === s1)
      )
      if (!corner || !edge) continue

      if (isF2LSlotComplete(f, dFace, corner, edge)) count++
    }
  }
  return count
}

function isF2LSlotComplete(f: string, dFace: number, corner: Corner, edge: Edge): boolean {
  for (const [pos, ctr] of corner) {
    if (ctr === dFace) {
      if (f[pos] !== 'Y') return false
    } else {
      if (f[pos] !== f[ctr]) return false
    }
  }
  const [p1, c1, p2, c2] = edge
  return f[p1] === f[c1] && f[p2] === f[c2]
}

// EOLL: all 4 edges on the W-center face have W on that face.
export function isEOLLDone(f: string): boolean {
  const ollFace = findFaceWithColor(f, 'W')
  if (ollFace === undefined) return false
  for (const [p1, c1, p2] of edgesOnFace(ollFace)) {
    const ownPos = c1 === ollFace ? p1 : p2
    if (f[ownPos] !== 'W') return false
  }
  return true
}

// OLL: all 9 stickers on the W-center face are W.
export function isOLLDone(f: string): boolean {
  const ollFace = findFaceWithColor(f, 'W')
  if (ollFace === undefined) return false
  for (const p of FACE_POSITIONS[ollFace]) {
    if (f[p] !== 'W') return false
  }
  return true
}

// CPLL: each non-W sticker of the 4 corners on the W-center face matches its
// adjacent face center.
export function isCPLLDone(f: string): boolean {
  const ollFace = findFaceWithColor(f, 'W')
  if (ollFace === undefined) return false
  for (const corner of cornersOnFace(ollFace)) {
    for (const [pos, ctr] of corner) {
      if (ctr === ollFace) continue
      if (f[pos] !== f[ctr]) return false
    }
  }
  return true
}
