/**
 * .arc File Schema (Version 0)
 *
 * Portable configuration format for Arc application.
 * Version 0 supports provider import only.
 */

import type { z } from 'zod'
import {
  ArcModelFilterSchema,
  ArcFileProviderSchema,
  ArcFileSchema,
  ArcImportResultSchema,
  ArcImportEventSchema,
  ProfileInfoSchema,
  ProfileInstallResultSchema,
  ProfilesEventSchema,
} from './arc-file.schema'

/** Schema version for migration support */
export const ARC_FILE_VERSION = 0

export type ArcModelFilter = z.infer<typeof ArcModelFilterSchema>
export type ArcFileProvider = z.infer<typeof ArcFileProviderSchema>
export type ArcFile = z.infer<typeof ArcFileSchema>
export type ArcImportResult = z.infer<typeof ArcImportResultSchema>
export type ArcImportEvent = z.infer<typeof ArcImportEventSchema>
export type ProfileInfo = z.infer<typeof ProfileInfoSchema>
export type ProfileInstallResult = z.infer<typeof ProfileInstallResultSchema>
export type ProfilesEvent = z.infer<typeof ProfilesEventSchema>
