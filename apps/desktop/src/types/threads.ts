/**
 * Thread Types
 */

import { z } from 'zod'

export const ContextMenuActionSchema = z.union([z.literal('rename'), z.null()])
export type ContextMenuAction = z.infer<typeof ContextMenuActionSchema>
