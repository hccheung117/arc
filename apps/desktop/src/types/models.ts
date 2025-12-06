/**
 * Model Types and Schemas
 *
 * Zod schemas for model and provider types with derived TypeScript types.
 */

import { z } from 'zod'

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('openai'),
})
export type Provider = z.infer<typeof ProviderSchema>

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: ProviderSchema,
})
export type Model = z.infer<typeof ModelSchema>
