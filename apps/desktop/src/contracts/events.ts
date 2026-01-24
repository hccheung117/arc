/**
 * Event Types
 *
 * Push event types for main → renderer communication.
 * These are NOT part of request-response contracts.
 */

import type { StoredThread } from '@main/modules/threads/json-file'

// ============================================================================
// EVENT TYPES
// ============================================================================

/** Thread lifecycle events */
export type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

/** AI stream events (IPC-safe: error is string, not Error object) */
export type AIStreamEvent =
  | { type: 'delta'; streamId: string; chunk: string }
  | { type: 'reasoning'; streamId: string; chunk: string }
  | { type: 'complete'; streamId: string; content: string; reasoning: string; usage: AIUsage }
  | { type: 'error'; streamId: string; error: string }

export interface AIUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens?: number
}

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void
