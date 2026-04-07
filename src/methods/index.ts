import type { SolveMethod } from '../types/solve'
import { CFOP } from './cfop'
import { ROUX } from './roux'

export { CFOP, ROUX }

export function getMethod(id?: string): SolveMethod {
  if (id === 'roux') return ROUX
  return CFOP
}
