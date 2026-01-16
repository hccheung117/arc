/**
 * Utils Contract
 *
 * Utility operations for file access and paths.
 */

import { z } from 'zod'
import { contract, op } from '@main/foundation/contract'

// ============================================================================
// CONTRACT
// ============================================================================

export const utilsContract = contract('utils', {
  /** Open a file with the native OS viewer */
  openFile: op(z.object({ filePath: z.string() }), undefined as void),

  /** Get absolute path for a thread attachment */
  getThreadAttachmentPath: op(
    z.object({
      threadId: z.string(),
      relativePath: z.string(),
    }),
    '' as string,
  ),
})
