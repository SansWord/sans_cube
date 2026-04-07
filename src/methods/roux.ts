import type { SolveMethod } from '../types/solve'
import {
  isFirstBlockDone,
  isSecondBlockDone,
  isCMLLDone,
  isEODone,
  isULURDone,
} from '../utils/roux'
import { isSolvedFacelets } from '../hooks/useCubeState'

export const ROUX: SolveMethod = {
  id: 'roux',
  label: 'Roux',
  phases: [
    {
      label: 'FB',
      color: '#8e44ad',
      isComplete: isFirstBlockDone,
    },
    {
      label: 'SB',
      color: '#9b59b6',
      isComplete: isSecondBlockDone,
    },
    {
      label: 'CMLL',
      color: '#e67e22',
      isComplete: isCMLLDone,
    },
    {
      label: 'EO',
      group: 'LSE',
      color: '#16a085',
      isComplete: isEODone,
    },
    {
      label: 'UL+UR',
      group: 'LSE',
      color: '#1abc9c',
      isComplete: isULURDone,
    },
    {
      label: 'EP',
      group: 'LSE',
      color: '#2ecc71',
      isComplete: isSolvedFacelets,
    },
  ],
}
