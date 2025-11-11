import type { Model } from '@arc/contracts/src/models'
import { getIPC } from './ipc'

export async function getModels(): Promise<Model[]> {
  return getIPC().getModels()
}
