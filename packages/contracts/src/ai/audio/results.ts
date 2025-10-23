import type { AudioMetadata } from './metadata.js';

/**
 * Result from an audio transcription request
 */
export interface AudioResult {
  /** The transcribed text */
  text: string;
  /** Metadata about the transcription */
  metadata: AudioMetadata;
}
