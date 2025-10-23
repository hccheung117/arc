import type { BaseMetadata } from '../common/metadata.js';

/**
 * Metadata for speech (TTS) generation
 */
export interface SpeechMetadata extends BaseMetadata {
  /** Audio format (mp3, opus, aac, flac, etc.) */
  format: string;
  /** Voice used for generation */
  voice: string;
  /** Speed/rate of speech */
  speed?: number;
}
