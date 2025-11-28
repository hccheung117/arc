import type { Model } from '@arc-types/models'
import type { ModelsEvent, Unsubscribe } from '@arc-types/arc-api'

export async function getModels(): Promise<Model[]> {
  return window.arc.models.list()
}

export function onModelsEvent(callback: (event: ModelsEvent) => void): Unsubscribe {
  return window.arc.models.onEvent(callback)
}
