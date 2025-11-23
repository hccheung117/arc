import type { Model } from '@arc-types/models'

export async function getModels(): Promise<Model[]> {
  return window.arc.models.list()
}
