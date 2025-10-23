import type { SpeechMetadata } from './metadata.js';

/**
 * Result from a speech (TTS) generation request
 */
export interface SpeechResult {
  /** The generated audio data */
  audio: ArrayBuffer;
  /** Metadata about the generation */
  metadata: SpeechMetadata;
}

/**
 * Chunk from a streaming speech generation
 */
export interface SpeechChunk {
  /** Audio data chunk */
  audio: ArrayBuffer;
  /** Metadata about the chunk */
  metadata: SpeechMetadata & { isLast?: boolean };
}
