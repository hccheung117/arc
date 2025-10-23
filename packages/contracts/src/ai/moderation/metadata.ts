import type { BaseMetadata } from '../common/metadata.js';

/**
 * Metadata for moderation
 */
export interface ModerationMetadata extends BaseMetadata {
  /** Detailed category flags */
  categories: Record<string, boolean>;
  /** Category confidence scores (0-1) */
  categoryScores: Record<string, number>;
}
