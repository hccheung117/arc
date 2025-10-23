import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { EmbeddingRequest, EmbeddingResponse } from "./types.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";

/**
 * Create embedding capability
 */
export function createEmbeddingCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  getHeaders: () => Record<string, string>
) {
  return {
    /**
     * Generate embedding for a single text
     */
    async embed(
      text: string,
      model: string,
      dimensions?: number
    ): Promise<{ vector: number[]; usage: { promptTokens: number; totalTokens: number } }> {
      try {
        const request: EmbeddingRequest = {
          model,
          input: text,
          encoding_format: 'float',
        };

        if (dimensions !== undefined) {
          request.dimensions = dimensions;
        }

        const response = await http.request(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw createProviderErrorFromResponse(
            response.status,
            response.body,
            response.headers
          );
        }

        const data = JSON.parse(response.body) as EmbeddingResponse;
        const embedding = data.data[0];

        if (!embedding) {
          throw new Error('No embedding returned from API');
        }

        return {
          vector: embedding.embedding,
          usage: {
            promptTokens: data.usage.prompt_tokens,
            totalTokens: data.usage.total_tokens,
          },
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'ProviderError') {
          throw error;
        }
        throw createProviderErrorFromNetworkError(error as Error);
      }
    },

    /**
     * Generate embeddings for multiple texts
     */
    async embedBatch(
      texts: string[],
      model: string,
      dimensions?: number
    ): Promise<{ vectors: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
      try {
        const request: EmbeddingRequest = {
          model,
          input: texts,
          encoding_format: 'float',
        };

        if (dimensions !== undefined) {
          request.dimensions = dimensions;
        }

        const response = await http.request(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw createProviderErrorFromResponse(
            response.status,
            response.body,
            response.headers
          );
        }

        const data = JSON.parse(response.body) as EmbeddingResponse;

        return {
          vectors: data.data.map(item => item.embedding),
          usage: {
            promptTokens: data.usage.prompt_tokens,
            totalTokens: data.usage.total_tokens,
          },
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'ProviderError') {
          throw error;
        }
        throw createProviderErrorFromNetworkError(error as Error);
      }
    },
  };
}
