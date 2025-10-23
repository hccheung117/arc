import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";

/**
 * Create embedding capability
 *
 * Note: Gemini has an embeddings API, but it's not yet implemented.
 * These are stubs for future implementation.
 */
export function createEmbeddingCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  apiKey: string,
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
      throw new Error('Gemini embeddings not yet implemented. Use OpenAI or implement Gemini embeddings API.');
    },

    /**
     * Generate embeddings for multiple texts
     */
    async embedBatch(
      texts: string[],
      model: string,
      dimensions?: number
    ): Promise<{ vectors: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
      throw new Error('Gemini batch embeddings not yet implemented. Use OpenAI or implement Gemini embeddings API.');
    },
  };
}
