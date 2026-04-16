import type { SolveMethod } from '../types/solve'
import {
  isFirstBlockDone,
  isSecondBlockDone,
  isCMLLDone,
  isEODone,
  isULURDone,
} from '../utils/roux'
import { isSolvedFacelets } from '../utils/applyMove'

export const ROUX: SolveMethod = {
  id: 'roux',
  label: 'Roux',
  phases: [
    {
      label: 'FB',
      color: '#e74c3c',
      isComplete: isFirstBlockDone,
    },
    {
      label: 'SB',
      color: '#2980b9',
      isComplete: isSecondBlockDone,
    },
    {
      label: 'CMLL',
      color: '#f39c12',
      isComplete: isCMLLDone,
    },
    {
      label: 'EO',
      group: 'LSE',
      color: '#27ae60',
      isComplete: isEODone,
    },
    {
      label: 'UL+UR',
      group: 'LSE',
      color: '#27ae60',
      isComplete: isULURDone,
    },
    {
      label: 'EP',
      group: 'LSE',
      color: '#27ae60',
      isComplete: isSolvedFacelets,
    },
  ],
}
