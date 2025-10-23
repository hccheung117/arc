import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type { IProvider, ModelInfo, ProviderCapabilities } from "@arc/contracts/IProvider.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";
import type { IEmbeddingProvider } from "../lib/builders/EmbeddingBuilder.js";
import type { IImageProvider } from "../lib/builders/ImageBuilder.js";
import type { IAudioProvider } from "../lib/builders/AudioBuilder.js";
import type { ISpeechProvider } from "../lib/builders/SpeechBuilder.js";
import type { IModerationProvider } from "../lib/builders/ModerationBuilder.js";

import { createChatCapability } from "./anthropic-chat.js";

/**
 * Anthropic Provider - unified provider with chat capabilities
 *
 * Provides methods for interacting with Anthropic's Messages API:
 * - Chat completions (Claude models)
 * - Model listing (static list)
 * - Health check
 *
 * Note: Anthropic only supports chat completions.
 * Other capabilities (embeddings, images, audio, speech, moderation) throw errors.
 */
export class AnthropicProvider implements
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
  private defaultMaxTokens: number;

  // Capability instances
  private chatCapability: ReturnType<typeof createChatCapability>;

  constructor(
    http: IPlatformHTTP,
    apiKey: string,
    options: {
      baseUrl?: string;
      customHeaders?: Record<string, string>;
      defaultMaxTokens?: number;
    } = {}
  ) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl?.endsWith("/")
      ? options.baseUrl.slice(0, -1)
      : (options.baseUrl || "https://api.anthropic.com/v1");
    this.customHeaders = options.customHeaders || {};
    this.defaultMaxTokens = options.defaultMaxTokens || 4096;

    // Initialize chat capability
    this.chatCapability = createChatCapability(
      this.http,
      this.baseUrl,
      () => this.getHeaders(),
      this.defaultMaxTokens
    );
  }

  /**
   * Get common headers for all requests
   */
  private getHeaders(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      ...this.customHeaders,
    };
  }

  // ==================== IProvider Methods ====================

  /**
   * List available models
   *
   * Note: Anthropic doesn't have a models API endpoint, so we return a static list
   */
  async listModels(): Promise<ModelInfo[]> {
    // Static list of Claude models
    const models: ModelInfo[] = [
      {
        id: "claude-3-opus-20240229",
        object: "model",
        created: 1709251200,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-sonnet-20240229",
        object: "model",
        created: 1709251200,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-haiku-20240307",
        object: "model",
        created: 1709769600,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        object: "model",
        created: 1729555200,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-5-haiku-20241022",
        object: "model",
        created: 1729555200,
        owned_by: "anthropic",
      },
    ];

    return models;
  }

  /**
   * Health check - verifies API key and connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to verify the API key
      // We'll use a very low max_tokens to minimize cost
      const response = await this.http.request(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: "claude-3-haiku-20240307", // Cheapest model
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderError") {
        throw error;
      }
      throw createProviderErrorFromNetworkError(error as Error);
    }
  }

  /**
   * Get capabilities for a specific model
   */
  getCapabilities(model: string): ProviderCapabilities {
    // Claude 3 models support vision
    const claude3Models = [
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
      'claude-3-5-sonnet',
      'claude-3-5-haiku',
    ];

    const supportsVision = claude3Models.some(m => model.includes(m));

    return {
      supportsVision,
      supportsStreaming: true,
      requiresMaxTokens: true,
      maxTokensDefault: this.defaultMaxTokens,
      supportedMessageRoles: ['user', 'assistant'], // system is separate
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

  // ==================== Unsupported APIs ====================
  // Anthropic only supports chat completions

  async embed(): Promise<{ vector: number[]; usage: { promptTokens: number; totalTokens: number } }> {
    throw new Error('Anthropic does not support embeddings. Use OpenAI or another provider for embeddings.');
  }

  async embedBatch(): Promise<{ vectors: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
    throw new Error('Anthropic does not support embeddings. Use OpenAI or another provider for embeddings.');
  }

  async generate(): Promise<{ url?: string; b64?: string; revisedPrompt?: string }> {
    throw new Error('Anthropic does not support image generation. Use OpenAI DALL-E or another provider for image generation.');
  }

  async edit(): Promise<{ url?: string; b64?: string }> {
    throw new Error('Anthropic does not support image editing. Use OpenAI DALL-E or another provider for image editing.');
  }

  async variations(): Promise<{ urls: string[] }> {
    throw new Error('Anthropic does not support image variations. Use OpenAI DALL-E or another provider for image variations.');
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
    throw new Error('Anthropic does not support audio transcription. Use OpenAI Whisper or another provider for audio transcription.');
  }

  async translate(): Promise<{ text: string }> {
    throw new Error('Anthropic does not support audio translation. Use OpenAI Whisper or another provider for audio translation.');
  }

  async speak(): Promise<{ audio: ArrayBuffer }> {
    throw new Error('Anthropic does not support text-to-speech. Use OpenAI TTS or another provider for speech synthesis.');
  }

  async *streamSpeak(): AsyncIterable<ArrayBuffer> {
    throw new Error('Anthropic does not support text-to-speech. Use OpenAI TTS or another provider for speech synthesis.');
  }

  async moderate(): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }> {
    throw new Error('Anthropic does not have a dedicated moderation API. Use OpenAI Moderation or implement custom moderation.');
  }
}
