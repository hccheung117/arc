/**
 * Files Contract
 *
 * File save dialog and write operations.
 */

import { z } from 'zod'
import { contract, op } from '@main/foundation/contract'

// ============================================================================
// SCHEMAS
// ============================================================================

export const SaveDialogOptionsSchema = z.object({
  defaultPath: z.string().optional(),
  filters: z.array(z.object({
    name: z.string(),
    extensions: z.array(z.string()),
  })).optional(),
})

// ============================================================================
// CONTRACT
// ============================================================================

export const filesContract = contract('files', {
  /** Show native save dialog, returns selected file path or null */
  showSaveDialog: op(SaveDialogOptionsSchema, null as string | null),

  /** Write content to a file */
  writeFile: op(
    z.object({
      filePath: z.string(),
      content: z.string(),
    }),
    undefined as void,
  ),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SaveDialogOptions = z.infer<typeof SaveDialogOptionsSchema>
