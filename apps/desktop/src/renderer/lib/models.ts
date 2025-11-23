import type { Model } from '../../types/models'

export async function getModels(): Promise<Model[]> {
  return window.arc.models.list()
}
