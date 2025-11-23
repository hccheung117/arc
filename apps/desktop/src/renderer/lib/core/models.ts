import type { Model } from '../../../types/models'
import { getIPC } from './ipc'

export async function getModels(): Promise<Model[]> {
  return getIPC().getModels()
}
