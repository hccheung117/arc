/**
 * Profiles Glob Capability Adapter
 *
 * Library for business: provides profile directory scanning and model filter matching.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedGlob = ReturnType<FoundationCapabilities['glob']>

export default defineCapability((glob: ScopedGlob) => ({
  listProfileDirs: () => glob.readdir('profiles'),
  matches: glob.matches,
}))
