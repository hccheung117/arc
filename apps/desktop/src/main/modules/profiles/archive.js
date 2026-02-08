/**
 * Profiles Archive Capability Adapter
 *
 * Library for business: provides archive extraction for profile installation.
 */

import { defineCapability } from '@main/kernel/module'

export default defineCapability((archive) => ({
  extractExternal: (externalAbsPath, targetDir) =>
    archive.extractExternal(externalAbsPath, targetDir),
}))
