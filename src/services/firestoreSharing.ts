import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { SolveRecord } from '../types/solve'

// Regex for validating a share ID extracted from a URL hash
export const SHARE_ID_RE = /^[A-Za-z0-9]{20}$/

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// Generate a 20-char base62 ID — same character space as Firestore auto-IDs
export function newShareId(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => BASE62[b % 62]).join('')
}

function publicSolveRef(shareId: string) {
  return doc(db, 'public_solves', shareId)
}

function registryRef(uid: string, shareId: string) {
  return doc(db, 'users', uid, 'shared_solves', shareId)
}

// Strip undefined values before writing to Firestore
function sanitize(solve: SolveRecord): object {
  return JSON.parse(JSON.stringify(solve))
}

/**
 * Share a solve publicly.
 * Registry doc is written first so the Firestore create rule's exists() check passes.
 * Returns the new shareId.
 */
export async function shareSolve(uid: string, solve: SolveRecord): Promise<string> {
  const shareId = newShareId()
  await setDoc(registryRef(uid, shareId), {})
  await setDoc(publicSolveRef(shareId), { solve: sanitize(solve) })
  return shareId
}

/**
 * Unshare a solve.
 * Public doc is deleted first while the registry still exists (required for the delete rule).
 * Then the registry doc is deleted.
 */
export async function unshareSolve(uid: string, shareId: string): Promise<void> {
  await deleteDoc(publicSolveRef(shareId))
  await deleteDoc(registryRef(uid, shareId))
}

/**
 * Update the public copy of a shared solve.
 * Called whenever the owner updates the solve (e.g. method change).
 */
export async function updateSharedSolve(shareId: string, solve: SolveRecord): Promise<void> {
  await setDoc(publicSolveRef(shareId), { solve: sanitize(solve) })
}

/**
 * Check if the given user owns a shared solve by looking up their registry doc.
 */
export async function isSharedSolveOwner(uid: string, shareId: string): Promise<boolean> {
  const snap = await getDoc(registryRef(uid, shareId))
  return snap.exists()
}

/**
 * Fetch a shared solve by shareId. No auth required.
 * Returns null if the document does not exist.
 */
export async function loadSharedSolve(shareId: string): Promise<SolveRecord | null> {
  const snap = await getDoc(publicSolveRef(shareId))
  if (!snap.exists()) return null
  return snap.data().solve as SolveRecord
}
