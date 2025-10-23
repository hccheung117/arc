import type { ChatMetadata } from './metadata.js';

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
