import type { Model } from '@main/modules/profiles/business'

export async function getModels(): Promise<Model[]> {
  return window.arc.profiles.listModels()
}
