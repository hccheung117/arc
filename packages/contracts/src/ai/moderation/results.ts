import type { ModerationMetadata } from './metadata.js';

/**
 * Result from a moderation check
 */
export interface ModerationResult {
  /** Whether the content was flagged */
  flagged: boolean;
  /** Metadata with category details */
  metadata: ModerationMetadata;
}
