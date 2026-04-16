import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { SolveRecord } from '../types/solve'
import { recalibrateSolveTimes } from '../utils/recalibrate'
import { migrateSolveV1toV2 } from '../utils/migrateSolveV1toV2'

function solvesRef(uid: string) {
  return collection(db, 'users', uid, 'solves')
}

// Document ID is String(solve.date) — unique per solve (Date.now() at solve time)
function solveDocRef(uid: string, solve: SolveRecord) {
  return doc(db, 'users', uid, 'solves', String(solve.date))
}

function counterRef(uid: string) {
  return doc(db, 'users', uid, 'meta', 'counter')
}

export async function loadNextSeqFromFirestore(uid: string): Promise<number> {
  const snap = await getDoc(counterRef(uid))
  return snap.exists() ? (snap.data().nextSeq as number) : 1
}

export async function updateCounterInFirestore(uid: string, nextSeq: number): Promise<void> {
  await setDoc(counterRef(uid), { nextSeq })
}

export async function loadSolvesFromFirestore(uid: string): Promise<SolveRecord[]> {
  const q = query(solvesRef(uid), orderBy('date', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => d.data() as SolveRecord)
}

// Firestore rejects undefined values — strip them via JSON round-trip
function sanitize(solve: SolveRecord): object {
  return JSON.parse(JSON.stringify(solve))
}

export async function addSolveToFirestore(uid: string, solve: SolveRecord): Promise<void> {
  await setDoc(solveDocRef(uid, solve), sanitize(solve))
}

export async function deleteSolveFromFirestore(uid: string, solve: SolveRecord): Promise<void> {
  await deleteDoc(solveDocRef(uid, solve))
}

export async function updateSolveInFirestore(uid: string, solve: SolveRecord): Promise<void> {
  await setDoc(solveDocRef(uid, solve), sanitize(solve))
}

export async function migrateLocalSolvesToFirestore(uid: string, solves: SolveRecord[]): Promise<void> {
  await Promise.all(solves.map((s) => addSolveToFirestore(uid, s)))
}

/**
 * Renumbers all Firestore solves sequentially (1..n) by date order.
 * Returns the next seq to use (n + 1).
 */
export async function renumberSolvesInFirestore(uid: string): Promise<number> {
  const solves = await loadSolvesFromFirestore(uid)
  const nextSeq = solves.length + 1
  await Promise.all([
    ...solves.map((s, i) => setDoc(solveDocRef(uid, s), sanitize({ ...s, seq: i + 1 }))),
    updateCounterInFirestore(uid, nextSeq),
  ])
  return nextSeq
}

/**
 * Recalibrates timeMs for all Firestore solves using hardware cubeTimestamps.
 * Only updates solves where the hardware span is shorter than the stored timeMs.
 * Returns the number of solves updated.
 */
export async function recalibrateSolvesInFirestore(uid: string): Promise<number> {
  const solves = await loadSolvesFromFirestore(uid)
  const recalibrated = recalibrateSolveTimes(solves)
  const changed = recalibrated.filter((s, i) => s.timeMs !== solves[i].timeMs)
  await Promise.all(changed.map((s) => setDoc(solveDocRef(uid, s), sanitize(s))))
  return changed.length
}

/**
 * Migrates all Firestore solves with schemaVersion < 2 to v2 (corrected M/E/S face labels).
 * Solves with M/E/S that pass the phase invariant are written with movesV1 for user review.
 * Returns { migrated, failed } counts for debug panel feedback.
 */
export async function migrateSolvesToV2InFirestore(uid: string): Promise<{ migrated: number; failed: number }> {
  const solves = await loadSolvesFromFirestore(uid)
  const pending = solves.filter(s => (s.schemaVersion ?? 1) < 2)

  let migrated = 0
  let failed = 0

  await Promise.all(pending.map(async (s) => {
    try {
      const result = migrateSolveV1toV2(s)
      if ((result.schemaVersion ?? 1) < 2) {
        // Migration returned unchanged (correctness check failed)
        failed++
        return
      }
      await setDoc(solveDocRef(uid, result), sanitize(result))
      migrated++
    } catch (e) {
      console.error(`[migrateSolvesToV2InFirestore] failed for id=${s.id}:`, e)
      failed++
    }
  }))

  return { migrated, failed }
}
