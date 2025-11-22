import type { Model } from '@shared/models'
import { getIPC } from './ipc'

export async function getModels(): Promise<Model[]> {
  return getIPC().getModels()
}
