import type { ImageMetadata } from './metadata.js';

/**
 * Result from an image generation request
 */
export interface ImageResult {
  /** URL to the generated image (http/https or data URL) */
  url?: string;
  /** Base64-encoded image data (if responseFormat is 'b64_json') */
  b64?: string;
  /** Metadata about the generation */
  metadata: ImageMetadata;
}

/**
 * Result from image variations request
 */
export interface ImageVariationsResult {
  /** URLs to the generated image variations */
  urls: string[];
  /** Metadata about the generation */
  metadata: ImageMetadata;
}
