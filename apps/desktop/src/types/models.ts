import type { z } from 'zod'
import { ProviderSchema, ModelSchema } from './models.schema'

export type Provider = z.infer<typeof ProviderSchema>
export type Model = z.infer<typeof ModelSchema>
