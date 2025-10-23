import type { IPlatformHTTP } from "@arc/contracts/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type { IProvider, ModelInfo, ProviderCapabilities } from "@arc/contracts/IProvider.js";
import type { ListModelsResponse } from "./types.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";
import type { IEmbeddingProvider } from "../lib/builders/EmbeddingBuilder.js";
import type { IImageProvider } from "../lib/builders/ImageBuilder.js";
import type { IAudioProvider } from "../lib/builders/AudioBuilder.js";
import type { ISpeechProvider } from "../lib/builders/SpeechBuilder.js";
import type { IModerationProvider } from "../lib/builders/ModerationBuilder.js";

import { createChatCapability } from "./gemini-chat.js";
import { createEmbeddingCapability } from "./gemini-embeddings.js";

/**
 * Gemini Provider - unified provider with chat and embedding capabilities
 *
 * Provides methods for interacting with Google's Gemini API:
 * - Chat completions (Gemini models)
 * - Model listing
 * - Health check
 * - Embeddings (stub for future implementation)
 *
 * Note: Gemini supports chat and embeddings (not yet implemented).
 * Other capabilities (images, audio, speech, moderation) are not supported.
 */
export class GeminiProvider implements
  IProvider,
  IEmbeddingProvider,
  IImageProvider,
  IAudioProvider,
  ISpeechProvider,
  IModerationProvider {

  private http: IPlatformHTTP;
  private apiKey: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;

  // Capability instances
  private chatCapability: ReturnType<typeof createChatCapability>;
  private embeddingCapability: ReturnType<typeof createEmbeddingCapability>;

  constructor(
    http: IPlatformHTTP,
    apiKey: string,
    options: {
      baseUrl?: string;
      customHeaders?: Record<string, string>;
    } = {}
  ) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl?.endsWith("/")
      ? options.baseUrl.slice(0, -1)
      : (options.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    this.customHeaders = options.customHeaders || {};

    // Initialize capabilities
    this.chatCapability = createChatCapability(
      this.http,
      this.baseUrl,
      this.apiKey,
      () => this.getHeaders()
    );
    this.embeddingCapability = createEmbeddingCapability(
      this.http,
      this.baseUrl,
      this.apiKey,
      () => this.getHeaders()
    );
  }

  /**
   * Get common headers for all requests
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...this.customHeaders,
    };
  }

  // ==================== IProvider Methods ====================

  /**
   * List available models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.http.request(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      const data = JSON.parse(response.body) as ListModelsResponse;

      // Convert Gemini model format to ModelInfo
      return data.models.map(model => ({
        id: model.name,
        object: "model",
        created: 0, // Gemini doesn't provide creation timestamp
        owned_by: "google",
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderError") {
        throw error;
      }
      throw createProviderErrorFromNetworkError(error as Error);
    }
  }

  /**
   * Health check - verifies API key and connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // List models is a lightweight endpoint to test connectivity
      await this.listModels();
      return true;
    } catch (error) {
      // Re-throw ProviderError for caller to handle
      throw error;
    }
  }

  /**
   * Get capabilities for a specific model
   */
  getCapabilities(model: string): ProviderCapabilities {
    // All Gemini models support multimodal inputs
    return {
      supportsVision: true,
      supportsStreaming: true,
      requiresMaxTokens: false, // Gemini has defaults
      supportedMessageRoles: ['user', 'model'], // Note: different from OpenAI/Anthropic
    };
  }

  /**
   * Stream chat completion
   */
  async *streamChatCompletion(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    model: string,
    attachments?: ImageAttachment[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, undefined> {
    yield* this.chatCapability.streamChatCompletion(messages, model, attachments, signal);
  }

  // ==================== IEmbeddingProvider Methods ====================

  async embed(
    text: string,
    model: string,
    dimensions?: number
  ): Promise<{ vector: number[]; usage: { promptTokens: number; totalTokens: number } }> {
    return this.embeddingCapability.embed(text, model, dimensions);
  }

  async embedBatch(
    texts: string[],
    model: string,
    dimensions?: number
  ): Promise<{ vectors: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
    return this.embeddingCapability.embedBatch(texts, model, dimensions);
  }

  // ==================== Unsupported APIs ====================

  async generate(): Promise<{ url?: string; b64?: string; revisedPrompt?: string }> {
    throw new Error('Gemini does not support image generation. Use OpenAI DALL-E or another provider for image generation.');
  }

  async edit(): Promise<{ url?: string; b64?: string }> {
    throw new Error('Gemini does not support image editing. Use OpenAI DALL-E or another provider for image editing.');
  }

  async variations(): Promise<{ urls: string[] }> {
    throw new Error('Gemini does not support image variations. Use OpenAI DALL-E or another provider for image variations.');
  }

  async transcribe(): Promise<{
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
    throw new Error('Gemini does not support audio transcription. Use OpenAI Whisper or another provider for audio transcription.');
  }

  async translate(): Promise<{ text: string }> {
    throw new Error('Gemini does not support audio translation. Use OpenAI Whisper or another provider for audio translation.');
  }

  async speak(): Promise<{ audio: ArrayBuffer }> {
    throw new Error('Gemini does not support text-to-speech. Use OpenAI TTS or another provider for speech synthesis.');
  }

  async *streamSpeak(): AsyncIterable<ArrayBuffer> {
    throw new Error('Gemini does not support text-to-speech. Use OpenAI TTS or another provider for speech synthesis.');
  }

  async moderate(): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }> {
    throw new Error('Gemini does not have a dedicated moderation API. Use OpenAI Moderation or implement custom moderation.');
  }
}
