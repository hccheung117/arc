/**
 * AI Contract
 *
 * AI chat streaming operations.
 * Events (delta, complete, error) are NOT part of the contract.
 */

import { z } from 'zod'
import { contract, op, returns } from '@main/foundation/contract'

// ============================================================================
// TYPES
// ============================================================================

export interface ChatResponse {
  streamId: string
}

// ============================================================================
// CONTRACT
// ============================================================================

export const aiContract = contract('ai', {
  /**
   * Start AI chat response stream.
   * Returns streamId for tracking. Listen to onEvent for streaming data.
   */
  chat: op(
    z.object({
      threadId: z.string(),
      model: z.string(),
    }),
    returns<ChatResponse>(),
  ),

  /** Cancel an active stream */
  stop: op(z.object({ streamId: z.string() }), undefined as void),

  /**
   * Refine a system prompt draft.
   * Returns streamId for tracking. Listen to onEvent for streaming data.
   * Stream emits refined prompt text, does not persist.
   */
  refine: op(
    z.object({
      prompt: z.string(),
      model: z.string(),
    }),
    returns<ChatResponse>(),
  ),
})
