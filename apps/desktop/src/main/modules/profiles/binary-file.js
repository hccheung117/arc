/**
 * Profiles Binary File Capability Adapter
 *
 * Library for business: provides atomic file operations for profile installation.
 */

import { defineCapability } from '@main/kernel/module'

export default defineCapability((binaryFile) => ({
  deleteDir: (relativePath) => binaryFile.deleteDir(relativePath),
  rename: (srcPath, dstPath) => binaryFile.rename(srcPath, dstPath),
  readFile: (relativePath) => binaryFile.read(relativePath),
}))
