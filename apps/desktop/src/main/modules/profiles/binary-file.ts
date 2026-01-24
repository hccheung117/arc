/**
 * Profiles Binary File Capability Adapter
 *
 * Library for business: provides atomic file operations for profile installation.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedBinaryFile = ReturnType<FoundationCapabilities['binaryFile']>

export default defineCapability((binaryFile: ScopedBinaryFile) => ({
  deleteDir: (relativePath: string) => binaryFile.deleteDir(relativePath),
  rename: (srcPath: string, dstPath: string) => binaryFile.rename(srcPath, dstPath),
  readFile: (relativePath: string) => binaryFile.read(relativePath),
}))
