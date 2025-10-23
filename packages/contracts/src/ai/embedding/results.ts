import type {
  EmbeddingMetadata,
  EmbeddingBatchMetadata,
  EmbeddingStreamMetadata,
} from './metadata.js';

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
