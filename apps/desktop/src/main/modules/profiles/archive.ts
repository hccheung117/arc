/**
 * Profiles Archive Capability Adapter
 *
 * Library for business: provides archive extraction for profile installation.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedArchive = ReturnType<FoundationCapabilities['archive']>

export default defineCapability((archive: ScopedArchive) => ({
  extractExternal: (externalAbsPath: string, targetDir: string) =>
    archive.extractExternal(externalAbsPath, targetDir),
}))
