/**
 * Arc File Schema Definitions
 *
 * Zod schemas for .arc file format and profile types.
 * Types are derived from these schemas using z.infer<>.
 */

import { z } from 'zod'

export const ArcModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})

export const ArcFileProviderSchema = z.object({
  type: z.string(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  modelFilter: ArcModelFilterSchema.optional(),
  modelAliases: z.record(z.string(), z.string()).optional(),
})

export const ArcFileSchema = z.object({
  version: z.number(),
  id: z.string(),
  name: z.string(),
  providers: z.array(ArcFileProviderSchema),
})

export const ArcImportResultSchema = z.object({
  success: z.boolean(),
  providersAdded: z.number(),
  providersUpdated: z.number(),
  errors: z.array(z.string()),
})

export const ArcImportEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('success'), result: ArcImportResultSchema }),
  z.object({ type: z.literal('error'), error: z.string() }),
])

export const ProfileInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerCount: z.number(),
})

export const ProfileInstallResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerCount: z.number(),
})

export const ProfilesEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('installed'), profile: ProfileInstallResultSchema }),
  z.object({ type: z.literal('uninstalled'), profileId: z.string() }),
  z.object({ type: z.literal('activated'), profileId: z.string().nullable() }),
])
