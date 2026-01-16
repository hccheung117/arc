import type { Model } from '@contracts/models'

export async function getModels(): Promise<Model[]> {
  return window.arc.models.list()
}
