import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
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

import { createChatCapability } from "./openai-chat.js";
import { createEmbeddingCapability } from "./openai-embeddings.js";
import { createImageCapability } from "./openai-images.js";
import { createAudioCapability } from "./openai-audio.js";
import { createSpeechCapability } from "./openai-speech.js";
import { createModerationCapability } from "./openai-moderation.js";

/**
 * OpenAI Provider - unified provider with all API capabilities
 *
 * Provides methods for interacting with OpenAI's API:
 * - Chat completions (with auto-fallback to legacy completions)
 * - Embeddings
 * - Image generation/editing/variations
 * - Audio transcription/translation
 * - Speech (TTS)
 * - Content moderation
 */
export class OpenAIProvider implements
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
  private imageCapability: ReturnType<typeof createImageCapability>;
  private audioCapability: ReturnType<typeof createAudioCapability>;
  private speechCapability: ReturnType<typeof createSpeechCapability>;
  private moderationCapability: ReturnType<typeof createModerationCapability>;

  constructor(
    http: IPlatformHTTP,
    apiKey: string,
    baseUrl: string = "https://api.openai.com/v1",
    customHeaders: Record<string, string> = {}
  ) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.customHeaders = customHeaders;

    // Initialize capabilities
    this.chatCapability = createChatCapability(this.http, this.baseUrl, () => this.getHeaders());
    this.embeddingCapability = createEmbeddingCapability(this.http, this.baseUrl, () => this.getHeaders());
    this.imageCapability = createImageCapability(this.http, this.baseUrl, () => this.getHeaders());
    this.audioCapability = createAudioCapability(this.http, this.baseUrl, () => this.getHeaders());
    this.speechCapability = createSpeechCapability(this.http, this.baseUrl, () => this.getHeaders());
    this.moderationCapability = createModerationCapability(this.http, this.baseUrl, () => this.getHeaders());
  }

  /**
   * Get common headers for all requests
   */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
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
      const response = await this.http.request(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      const data = JSON.parse(response.body) as ListModelsResponse;
      return data.data;
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
    // Vision-capable models (GPT-4V and beyond)
    const visionModels = [
      'gpt-4-vision',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4.1',
      'gpt-4.5',
      'gpt-5',
    ];

    const supportsVision = visionModels.some(vm => model.includes(vm));

    return {
      supportsVision,
      supportsStreaming: true,
      requiresMaxTokens: false, // OpenAI has defaults
      supportedMessageRoles: ['user', 'assistant', 'system'],
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

  // ==================== IImageProvider Methods ====================

  async generate(
    prompt: string,
    model: string,
    options?: any
  ): Promise<{ url?: string; b64?: string; revisedPrompt?: string }> {
    return this.imageCapability.generate(prompt, model, options);
  }

  async edit(
    options: any,
    model: string
  ): Promise<{ url?: string; b64?: string }> {
    return this.imageCapability.edit(options, model);
  }

  async variations(
    image: File | ArrayBuffer | string,
    model: string,
    options?: any
  ): Promise<{ urls: string[] }> {
    return this.imageCapability.variations(image, model, options);
  }

  // ==================== IAudioProvider Methods ====================

  async transcribe(
    audio: File | ArrayBuffer | Blob,
    model: string,
    options?: any
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
    return this.audioCapability.transcribe(audio, model, options);
  }

  async translate(
    audio: File | ArrayBuffer | Blob,
    model: string
  ): Promise<{ text: string }> {
    return this.audioCapability.translate(audio, model);
  }

  // ==================== ISpeechProvider Methods ====================

  async speak(
    text: string,
    model: string,
    voice: any,
    options?: any
  ): Promise<{ audio: ArrayBuffer }> {
    return this.speechCapability.speak(text, model, voice, options);
  }

  async *streamSpeak(
    text: string,
    model: string,
    voice: any,
    options?: any
  ): AsyncIterable<ArrayBuffer> {
    yield* this.speechCapability.streamSpeak(text, model, voice, options);
  }

  // ==================== IModerationProvider Methods ====================

  async moderate(content: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }> {
    return this.moderationCapability.moderate(content);
  }
}
