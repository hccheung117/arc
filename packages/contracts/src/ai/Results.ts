import type {
  ChatMetadata,
  EmbeddingMetadata,
  EmbeddingBatchMetadata,
  EmbeddingStreamMetadata,
  ImageMetadata,
  AudioMetadata,
  SpeechMetadata,
  ModerationMetadata,
} from './Metadata.js';

/**
 * Result from a chat completion
 */
export interface ChatResult {
  /** The generated text content */
  content: string;
  /** Metadata about the completion */
  metadata: ChatMetadata;
}

/**
 * Chunk from a streaming chat completion
 */
export interface ChatChunk {
  /** The content delta for this chunk */
  content: string;
  /** Metadata (includes finishReason only on the last chunk) */
  metadata: Partial<ChatMetadata> & { model: string; provider: string };
}

/**
 * Result from an embedding request
 */
export interface EmbeddingResult {
  /** The embedding vector */
  vector: number[];
  /** Metadata about the embedding */
  metadata: EmbeddingMetadata;
}

/**
 * Result from a batch embedding request
 */
export interface EmbeddingBatchResult {
  /** Array of embedding vectors */
  vectors: number[][];
  /** Metadata about the batch */
  metadata: EmbeddingBatchMetadata;
}

/**
 * Chunk from a streaming embedding request
 */
export interface EmbeddingChunk {
  /** The embedding vector */
  vector: number[];
  /** Metadata including stream position */
  metadata: EmbeddingStreamMetadata;
}

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

/**
 * Result from an audio transcription request
 */
export interface AudioResult {
  /** The transcribed text */
  text: string;
  /** Metadata about the transcription */
  metadata: AudioMetadata;
}

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

/**
 * Result from a moderation check
 */
export interface ModerationResult {
  /** Whether the content was flagged */
  flagged: boolean;
  /** Metadata with category details */
  metadata: ModerationMetadata;
}
