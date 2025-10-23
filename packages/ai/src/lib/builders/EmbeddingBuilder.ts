import type { IEmbeddingBuilder } from '@arc/contracts/ai/embedding/builder.js';
import type {
  EmbeddingResult,
  EmbeddingBatchResult,
  EmbeddingChunk,
} from '@arc/contracts/ai/embedding/results.js';
import type { CancellableStream as ICancellableStream } from '@arc/contracts/ai/streams/cancellable-stream.js';
import type { Provider } from '@arc/contracts/ai/common/metadata.js';
import { createCancellableStream } from '../streams/CancellableStream.js';

/**
 * Provider interface for embeddings
 * This will be implemented by provider adapters
 */
export interface IEmbeddingProvider {
  embed(text: string, model: string, dimensions?: number): Promise<{
    vector: number[];
    usage: { promptTokens: number; totalTokens: number };
  }>;

  embedBatch(texts: string[], model: string, dimensions?: number): Promise<{
    vectors: number[][];
    usage: { promptTokens: number; totalTokens: number };
  }>;
}

/**
 * Fluent embedding builder implementation
 */
export class EmbeddingBuilder implements IEmbeddingBuilder {
  private selectedModel?: string;
  private selectedDimensions?: number;

  constructor(
    private provider: IEmbeddingProvider,
    private providerType: Provider
  ) {}

  /**
   * Set the model to use
   */
  model(model: string): IEmbeddingBuilder {
    this.selectedModel = model;
    return this;
  }

  /**
   * Set embedding dimensions
   */
  dimensions(dimensions: number): IEmbeddingBuilder {
    this.selectedDimensions = dimensions;
    return this;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    this.validateState();

    const result = await this.provider.embed(
      text,
      this.selectedModel!,
      this.selectedDimensions
    );

    return {
      vector: result.vector,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: 0,
          totalTokens: result.usage.totalTokens,
        },
        dimensions: result.vector.length,
      },
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<EmbeddingBatchResult> {
    this.validateState();

    const result = await this.provider.embedBatch(
      texts,
      this.selectedModel!,
      this.selectedDimensions
    );

    return {
      vectors: result.vectors,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: 0,
          totalTokens: result.usage.totalTokens,
        },
        dimensions: result.vectors[0]?.length || 0,
        count: result.vectors.length,
      },
    };
  }

  /**
   * Stream embeddings for multiple texts
   */
  embedStream(texts: string[]): ICancellableStream<EmbeddingChunk> {
    this.validateState();

    const model = this.selectedModel!;
    const dimensions = this.selectedDimensions;
    const provider = this.provider;
    const providerType = this.providerType;
    const total = texts.length;

    return createCancellableStream(async function* (signal) {
      for (let i = 0; i < texts.length; i++) {
        if (signal.aborted) {
          return;
        }

        const result = await provider.embed(texts[i]!, model, dimensions);

        yield {
          vector: result.vector,
          metadata: {
            model,
            provider: providerType,
            usage: {
              promptTokens: result.usage.promptTokens,
              completionTokens: 0,
              totalTokens: result.usage.totalTokens,
            },
            dimensions: result.vector.length,
            index: i,
            total,
          },
        };
      }
    });
  }

  /**
   * Validate builder state
   */
  private validateState(): void {
    if (!this.selectedModel) {
      throw new Error('Model must be set before generating embeddings');
    }
  }
}
