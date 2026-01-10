/**
 * Arc File Types and Schemas
 *
 * Zod schemas for .arc file format and profile types with derived TypeScript types.
 */

import { z } from 'zod'

/** Schema version for migration support */
export const ARC_FILE_VERSION = 0

export const ArcModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})
export type ArcModelFilter = z.infer<typeof ArcModelFilterSchema>

export const ArcFileProviderSchema = z.object({
  type: z.string(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  modelFilter: ArcModelFilterSchema.optional(),
  modelAliases: z.record(z.string(), z.string()).optional(),
})
export type ArcFileProvider = z.infer<typeof ArcFileProviderSchema>

export const ArcFileSchema = z.object({
  version: z.number(),
  id: z.string(),
  name: z.string(),
  providers: z.array(ArcFileProviderSchema),
  updateInterval: z.number().min(1).optional(),
})
export type ArcFile = z.infer<typeof ArcFileSchema>

export const ProfileInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerCount: z.number(),
})
export type ProfileInfo = z.infer<typeof ProfileInfoSchema>

export const ProfileInstallResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerCount: z.number(),
})
export type ProfileInstallResult = z.infer<typeof ProfileInstallResultSchema>

export const ProfilesEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('installed'), profile: ProfileInstallResultSchema }),
  z.object({ type: z.literal('uninstalled'), profileId: z.string() }),
  z.object({ type: z.literal('activated'), profileId: z.string().nullable() }),
])
export type ProfilesEvent = z.infer<typeof ProfilesEventSchema>
