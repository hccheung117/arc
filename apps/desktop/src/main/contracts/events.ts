/**
 * Event Types
 *
 * Push event types for main → renderer communication.
 * These are NOT part of request-response contracts.
 */

import type { Thread } from './threads'
import type { Persona } from './personas'
import type { Message } from './messages'

// ============================================================================
// EVENT TYPES
// ============================================================================

/** Thread lifecycle events */
export type ThreadEvent =
  | { type: 'created'; thread: Thread }
  | { type: 'updated'; thread: Thread }
  | { type: 'deleted'; id: string }

/** Persona lifecycle events */
export type PersonasEvent =
  | { type: 'created'; persona: Persona }
  | { type: 'updated'; persona: Persona }
  | { type: 'deleted'; name: string }

/** AI stream events (IPC-safe: error is string, not Error object) */
export type AIStreamEvent =
  | { type: 'delta'; streamId: string; chunk: string }
  | { type: 'reasoning'; streamId: string; chunk: string }
  | { type: 'complete'; streamId: string; message: Message }
  | { type: 'error'; streamId: string; error: string }

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void
