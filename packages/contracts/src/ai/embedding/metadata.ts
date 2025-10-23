import type { BaseMetadata, Usage } from '../common/metadata.js';

/**
 * Metadata for embeddings
 */
export interface EmbeddingMetadata extends BaseMetadata {
  /** Token usage for the embedding request */
  usage: Usage;
  /** Dimension of the embedding vector */
  dimensions: number;
}

/**
 * Metadata for batch embeddings
 */
export interface EmbeddingBatchMetadata extends BaseMetadata {
  /** Total tokens used across all embeddings */
  usage: Usage;
  /** Dimension of the embedding vectors */
  dimensions: number;
  /** Number of embeddings in the batch */
  count: number;
}

/**
 * Metadata for streaming embeddings
 */
export interface EmbeddingStreamMetadata extends EmbeddingMetadata {
  /** Index of this embedding in the stream */
  index: number;
  /** Total number of embeddings in the stream */
  total: number;
}
