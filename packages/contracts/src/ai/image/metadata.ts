import type { BaseMetadata } from '../common/metadata.js';

/**
 * Metadata for image generation
 */
export interface ImageMetadata extends BaseMetadata {
  /** The revised/enhanced prompt used by the model (if available) */
  revisedPrompt?: string;
  /** When the image was created (Unix timestamp) */
  created?: number;
}
