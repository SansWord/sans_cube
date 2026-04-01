import type { SolveMethod } from '../types/solve'
import {
  isCrossDone,
  countCompletedF2LSlots,
  isEOLLDone,
  isOLLDone,
  isCPLLDone,
} from '../utils/cfop'
import { isSolvedFacelets } from '../hooks/useCubeState'

export const CFOP: SolveMethod = {
  id: 'cfop',
  label: 'CFOP',
  phases: [
    {
      label: 'Cross',
      color: '#e74c3c',
      isComplete: isCrossDone,
    },
    {
      label: 'F2L Slot 1',
      group: 'F2L',
      color: '#2980b9',
      isComplete: (f) => countCompletedF2LSlots(f) >= 1,
    },
    {
      label: 'F2L Slot 2',
      group: 'F2L',
      color: '#3498db',
      isComplete: (f) => countCompletedF2LSlots(f) >= 2,
    },
    {
      label: 'F2L Slot 3',
      group: 'F2L',
      color: '#5dade2',
      isComplete: (f) => countCompletedF2LSlots(f) >= 3,
    },
    {
      label: 'F2L Slot 4',
      group: 'F2L',
      color: '#85c1e9',
      isComplete: (f) => countCompletedF2LSlots(f) >= 4,
    },
    {
      label: 'EOLL',
      color: '#f39c12',
      isComplete: isEOLLDone,
    },
    {
      label: 'OLL',
      color: '#e67e22',
      isComplete: isOLLDone,
    },
    {
      label: 'CPLL',
      color: '#27ae60',
      isComplete: isCPLLDone,
    },
    {
      label: 'PLL',
      color: '#2ecc71',
      isComplete: isSolvedFacelets,
    },
  ],
}
