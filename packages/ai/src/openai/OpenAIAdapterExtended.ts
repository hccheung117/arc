import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type { IProvider, ModelInfo, ProviderCapabilities } from "@arc/contracts/IProvider.js";
import type {
  OpenAIMessage,
  OpenAIMessageContent,
  ChatCompletionRequest,
  LegacyCompletionRequest,
  ListModelsResponse,
  OpenAIModel,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  AudioTranscriptionJsonResponse,
  AudioTranscriptionVerboseResponse,
  SpeechGenerationRequest,
  ModerationRequest,
  ModerationResponse,
} from "./types.js";
import {
  parseStreamChunk,
  extractChunkContent,
  isStreamComplete,
} from "./streaming.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";
import { ProviderErrorCode } from "@arc/core/domain/ProviderError.js";
import type { IEmbeddingProvider } from "../builders/EmbeddingBuilder.js";
import type { IImageProvider } from "../builders/ImageBuilder.js";
import type { IAudioProvider } from "../builders/AudioBuilder.js";
import type { ISpeechProvider } from "../builders/SpeechBuilder.js";
import type { IModerationProvider } from "../builders/ModerationBuilder.js";
import type { Voice, SpeechOptions } from "@arc/contracts/ai/SpeechBuilder.js";
import type { AudioTranscriptionOptions } from "@arc/contracts/ai/AudioBuilder.js";
import type { ImageGenerationOptions, ImageEditOptions, ImageVariationsOptions, ImageResponseFormat } from "@arc/contracts/ai/ImageBuilder.js";

// Import the original adapter to extend it
import { OpenAIAdapter as BaseOpenAIAdapter } from "./OpenAIAdapter.js";

/**
 * Extended OpenAI API adapter with all API capabilities
 *
 * Extends the base OpenAIAdapter with:
 * - Embeddings
 * - Image generation/editing/variations
 * - Audio transcription/translation
 * - Speech (TTS)
 * - Content moderation
 */
export class OpenAIAdapterExtended extends BaseOpenAIAdapter implements
  IEmbeddingProvider,
  IImageProvider,
  IAudioProvider,
  ISpeechProvider,
  IModerationProvider {

  // Access private members through protected getters
  private get http(): IPlatformHTTP {
    return (this as any).http;
  }

  private get apiKey(): string {
    return (this as any).apiKey;
  }

  private get baseUrl(): string {
    return (this as any).baseUrl;
  }

  private get customHeaders(): Record<string, string> {
    return (this as any).customHeaders;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...this.customHeaders,
    };
  }

  // ==================== Embedding APIs ====================

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

      const response = await this.http.request(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
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
  }

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

      const response = await this.http.request(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
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
  }

  // ==================== Image Generation APIs ====================

  /**
   * Generate an image from a text prompt
   */
  async generate(
    prompt: string,
    model: string,
    options?: ImageGenerationOptions & { responseFormat?: ImageResponseFormat }
  ): Promise<{ url?: string; b64?: string; revisedPrompt?: string }> {
    try {
      const request: ImageGenerationRequest = {
        prompt,
        model,
        n: options?.n || 1,
        response_format: options?.responseFormat || 'url',
      };

      if (options?.size) request.size = options.size;
      if (options?.quality) request.quality = options.quality;
      if (options?.style) request.style = options.style;
      if (options?.user) request.user = options.user;

      const response = await this.http.request(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      const data = JSON.parse(response.body) as ImageGenerationResponse;
      const image = data.data[0];

      if (!image) {
        throw new Error('No image returned from API');
      }

      return {
        url: image.url,
        b64: image.b64_json,
        revisedPrompt: image.revised_prompt,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'ProviderError') {
        throw error;
      }
      throw createProviderErrorFromNetworkError(error as Error);
    }
  }

  /**
   * Edit an image (DALL-E 2 only)
   */
  async edit(
    options: ImageEditOptions,
    model: string
  ): Promise<{ url?: string; b64?: string }> {
    // Note: Image editing requires multipart/form-data which is complex in a platform-agnostic way
    // This is a simplified implementation that would need platform-specific handling
    throw new Error('Image editing not yet fully implemented - requires platform-specific FormData handling');
  }

  /**
   * Create variations of an image (DALL-E 2 only)
   */
  async variations(
    image: File | ArrayBuffer | string,
    model: string,
    options?: ImageVariationsOptions
  ): Promise<{ urls: string[] }> {
    // Note: Image variations require multipart/form-data
    throw new Error('Image variations not yet fully implemented - requires platform-specific FormData handling');
  }

  // ==================== Audio Transcription APIs ====================

  /**
   * Transcribe audio to text
   */
  async transcribe(
    audio: File | ArrayBuffer | Blob,
    model: string,
    options?: AudioTranscriptionOptions
  ): Promise<{
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
      confidence?: number;
    }>;
  }> {
    // Note: Audio transcription requires multipart/form-data
    // This would need platform-specific handling for FormData
    throw new Error('Audio transcription not yet fully implemented - requires platform-specific FormData handling');
  }

  /**
   * Translate audio to English
   */
  async translate(
    audio: File | ArrayBuffer | Blob,
    model: string
  ): Promise<{ text: string }> {
    // Note: Audio translation requires multipart/form-data
    throw new Error('Audio translation not yet fully implemented - requires platform-specific FormData handling');
  }

  // ==================== Speech (TTS) APIs ====================

  /**
   * Generate speech from text
   */
  async speak(
    text: string,
    model: string,
    voice: Voice,
    options?: SpeechOptions
  ): Promise<{ audio: ArrayBuffer }> {
    try {
      const request: SpeechGenerationRequest = {
        model,
        input: text,
        voice,
        response_format: options?.format || 'mp3',
      };

      if (options?.speed !== undefined) {
        request.speed = options.speed;
      }

      const response = await this.http.request(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      // Note: In a real implementation, the HTTP client would need to support binary responses
      // For now, we assume the response body can be converted to ArrayBuffer
      const audioBuffer = this.stringToArrayBuffer(response.body);

      return { audio: audioBuffer };
    } catch (error) {
      if (error instanceof Error && error.name === 'ProviderError') {
        throw error;
      }
      throw createProviderErrorFromNetworkError(error as Error);
    }
  }

  /**
   * Stream speech generation (not natively supported by OpenAI, so we return the full result)
   */
  async *streamSpeak(
    text: string,
    model: string,
    voice: Voice,
    options?: SpeechOptions
  ): AsyncIterable<ArrayBuffer> {
    // OpenAI doesn't support streaming TTS, so we yield the full result
    const result = await this.speak(text, model, voice, options);
    yield result.audio;
  }

  // ==================== Moderation APIs ====================

  /**
   * Check content for policy violations
   */
  async moderate(content: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }> {
    try {
      const request: ModerationRequest = {
        input: content,
      };

      const response = await this.http.request(`${this.baseUrl}/moderations`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      const data = JSON.parse(response.body) as ModerationResponse;
      const result = data.results[0];

      if (!result) {
        throw new Error('No moderation result returned from API');
      }

      return {
        flagged: result.flagged,
        categories: result.categories as Record<string, boolean>,
        categoryScores: result.category_scores as Record<string, number>,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'ProviderError') {
        throw error;
      }
      throw createProviderErrorFromNetworkError(error as Error);
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Convert string to ArrayBuffer (helper for audio responses)
   * Note: This is a placeholder - real implementation would handle binary data properly
   */
  private stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }
}
