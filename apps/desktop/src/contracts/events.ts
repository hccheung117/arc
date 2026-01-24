/**
 * Event Types
 *
 * Push event types for main → renderer communication.
 * These are NOT part of request-response contracts.
 */

import type { StoredThread, StoredMessageEvent } from '@main/modules/messages/business'
import type { Persona } from './personas'
import type { ProfileInstallResult } from './profiles'

// ============================================================================
// EVENT TYPES
// ============================================================================

/** Thread lifecycle events */
export type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

/** Persona lifecycle events */
export type PersonasEvent =
  | { type: 'created'; persona: Persona }
  | { type: 'updated'; persona: Persona }
  | { type: 'deleted'; name: string }

/** Profile lifecycle events */
export type ProfilesEvent =
  | { type: 'installed'; profile: ProfileInstallResult }
  | { type: 'uninstalled'; profileId: string }
  | { type: 'activated'; profileId: string | null }

/** AI stream events (IPC-safe: error is string, not Error object) */
export type AIStreamEvent =
  | { type: 'delta'; streamId: string; chunk: string }
  | { type: 'reasoning'; streamId: string; chunk: string }
  | { type: 'complete'; streamId: string; message: StoredMessageEvent | null }
  | { type: 'error'; streamId: string; error: string }

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void
