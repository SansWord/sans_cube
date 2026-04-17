import type { SolveMethod } from '../types/solve'
import { CFOP } from './cfop'
import { ROUX } from './roux'
import { FREEFORM } from './freeform'

export { CFOP, ROUX, FREEFORM }

export function getMethod(id?: string): SolveMethod {
  if (id === 'roux') return ROUX
  if (id === 'freeform') return FREEFORM
  return CFOP
}
