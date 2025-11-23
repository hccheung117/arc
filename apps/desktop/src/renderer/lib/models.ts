import type { Model } from '../../types/models'
import { getArc } from './ipc'

export async function getModels(): Promise<Model[]> {
  return getArc().models.list()
}
