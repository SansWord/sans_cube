import type { SolveMethod } from '../types/solve'
import { isSolvedFacelets } from '../utils/applyMove'

export const FREEFORM: SolveMethod = {
  id: 'freeform',
  label: 'Freeform',
  phases: [
    {
      label: 'Solved',
      color: '#27ae60',
      isComplete: isSolvedFacelets,
    },
  ],
}
