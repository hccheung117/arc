import type { EmbeddingResult, EmbeddingBatchResult, EmbeddingChunk } from './results.js';
import type { CancellableStream } from '../streams/cancellable-stream.js';

/**
 * Fluent builder interface for embeddings
 *
 * Usage:
 * ```typescript
 * const result = await ai.embedding
 *   .model('text-embedding-3-large')
 *   .embed('Hello world');
 * ```
 */
export interface IEmbeddingBuilder {
  /**
   * Set the model to use
   *
   * @param model - Embedding model identifier
   */
  model(model: string): IEmbeddingBuilder;

  /**
   * Set the embedding dimensions (OpenAI only)
   *
   * Reduces the embedding size for efficiency
   *
   * @param dimensions - Target dimension count
   */
  dimensions(dimensions: number): IEmbeddingBuilder;

  /**
   * Generate an embedding for a single text
   *
   * @param text - Text to embed
   * @returns Promise that resolves to the embedding result
   */
  embed(text: string): Promise<EmbeddingResult>;

  /**
   * Generate embeddings for multiple texts
   *
   * @param texts - Array of texts to embed
   * @returns Promise that resolves to batch embedding result
   */
  embedBatch(texts: string[]): Promise<EmbeddingBatchResult>;

  /**
   * Stream embeddings for multiple texts
   *
   * Useful for processing large batches one at a time
   *
   * @param texts - Array of texts to embed
   * @returns A cancellable async iterable of embedding chunks
   */
  embedStream(texts: string[]): CancellableStream<EmbeddingChunk>;
}
