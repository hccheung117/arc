import type { IChatBuilder } from './chat/builder.js';
import type { IEmbeddingBuilder } from './embedding/builder.js';
import type { IImageBuilder } from './image/builder.js';
import type { IAudioBuilder } from './audio/builder.js';
import type { ISpeechBuilder } from './speech/builder.js';
import type { IModerationBuilder } from './moderation/builder.js';
import type { ModelInfo, ProviderCapabilities } from '../IProvider.js';
import type { Provider } from './common/metadata.js';

/**
 * Configuration options for AI provider
 */
export interface AIConfig {
  /** API key for the provider */
  apiKey: string;
  /** Optional custom base URL (for proxies) */
  baseUrl?: string;
  /** Optional custom headers */
  customHeaders?: Record<string, string>;
  /** Default max tokens for Anthropic (optional) */
  defaultMaxTokens?: number;
}

/**
 * Main AI interface - entry point for all AI operations
 *
 * Usage:
 * ```typescript
 * const ai = new AI('openai', { apiKey: '...' });
 *
 * // Chat
 * const chat = await ai.chat.model('gpt-4').userSays('Hi').generate();
 *
 * // Embeddings
 * const emb = await ai.embedding.model('text-embedding-3-large').embed('text');
 *
 * // Images
 * const img = await ai.image.model('dall-e-3').generate('A sunset');
 *
 * // Audio
 * const text = await ai.audio.model('whisper-1').transcribe(audioFile);
 *
 * // Speech
 * const audio = await ai.speech.model('tts-1').voice('alloy').speak('Hello');
 *
 * // Moderation
 * const mod = await ai.moderation.check('content to check');
 * ```
 */
export interface IAI {
  /** The provider type */
  readonly provider: Provider;

  /** Chat completion builder */
  readonly chat: IChatBuilder;

  /** Embedding builder */
  readonly embedding: IEmbeddingBuilder;

  /** Image generation builder */
  readonly image: IImageBuilder;

  /** Audio transcription builder */
  readonly audio: IAudioBuilder;

  /** Speech (TTS) builder */
  readonly speech: ISpeechBuilder;

  /** Moderation builder */
  readonly moderation: IModerationBuilder;
}

/**
 * Extended chat builder with utility methods
 */
export interface IChatBuilderWithUtils extends IChatBuilder {
  /**
   * List available models
   *
   * @returns Promise that resolves to array of model info
   */
  models(): Promise<ModelInfo[]>;

  /**
   * Health check - verifies API key and connection
   *
   * @returns Promise that resolves to true if healthy
   * @throws ProviderError if connection fails
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get capabilities for a specific model
   *
   * @param model - Model identifier
   * @returns Promise that resolves to capabilities
   */
  capabilities(model: string): Promise<ProviderCapabilities>;
}
