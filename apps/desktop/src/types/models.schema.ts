/**
 * Model Schema Definitions
 *
 * Zod schemas for model and provider types.
 * Types are derived from these schemas using z.infer<>.
 */

import { z } from 'zod'

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('openai'),
})

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: ProviderSchema,
})
