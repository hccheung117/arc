import { z } from 'zod'
import { contract, op } from '@main/kernel/ipc'

const FavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})

export const settingsContract = contract('settings', {
  getFavorites: op(z.void(), null as unknown as Array<{ providerId: string; modelId: string }>),
  setFavorites: op(z.object({ favorites: z.array(FavoriteSchema) }), undefined as void),
})
