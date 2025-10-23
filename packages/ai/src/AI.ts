import type { IAI, AIConfig, IChatBuilderWithUtils } from '@arc/contracts/ai/IAI.js';
import type { Provider } from '@arc/contracts/ai/Metadata.js';
import type { ModelInfo, ProviderCapabilities } from '@arc/contracts/IProvider.js';
import type { IPlatformHTTP } from '@arc/core/platform/IPlatformHTTP.js';

import { ChatBuilder } from './builders/ChatBuilder.js';
import { EmbeddingBuilder } from './builders/EmbeddingBuilder.js';
import { ImageBuilder } from './builders/ImageBuilder.js';
import { AudioBuilder } from './builders/AudioBuilder.js';
import { SpeechBuilder } from './builders/SpeechBuilder.js';
import { ModerationBuilder } from './builders/ModerationBuilder.js';

import { OpenAIAdapter } from './openai/OpenAIAdapter.js';
import { AnthropicAdapter } from './anthropic/AnthropicAdapter.js';
import { GeminiAdapter } from './gemini/GeminiAdapter.js';

import type { IEmbeddingProvider } from './builders/EmbeddingBuilder.js';
import type { IImageProvider } from './builders/ImageBuilder.js';
import type { IAudioProvider } from './builders/AudioBuilder.js';
import type { ISpeechProvider } from './builders/SpeechBuilder.js';
import type { IModerationProvider } from './builders/ModerationBuilder.js';

/**
 * Extended provider interface that includes all API capabilities
 */
interface IExtendedProvider extends
  IEmbeddingProvider,
  IImageProvider,
  IAudioProvider,
  ISpeechProvider,
  IModerationProvider {
  // Chat methods from IProvider are inherited through the adapters
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<boolean>;
  getCapabilities(model: string): ProviderCapabilities;
}

/**
 * Chat builder with utility methods
 */
class ChatBuilderWithUtils extends ChatBuilder implements IChatBuilderWithUtils {
  constructor(
    provider: IExtendedProvider,
    providerType: Provider
  ) {
    super(provider as any, providerType);
    this.extendedProvider = provider;
  }

  private extendedProvider: IExtendedProvider;

  async models(): Promise<ModelInfo[]> {
    return this.extendedProvider.listModels();
  }

  async healthCheck(): Promise<boolean> {
    return this.extendedProvider.healthCheck();
  }

  async capabilities(model: string): Promise<ProviderCapabilities> {
    return Promise.resolve(this.extendedProvider.getCapabilities(model));
  }
}

/**
 * Main AI class - entry point for all AI operations
 *
 * Usage:
 * ```typescript
 * const ai = new AI('openai', { apiKey: '...' });
 * const result = await ai.chat.model('gpt-4').userSays('Hi').generate();
 * ```
 */
export class AI implements IAI {
  public readonly provider: Provider;
  public readonly chat: IChatBuilderWithUtils;
  public readonly embedding: EmbeddingBuilder;
  public readonly image: ImageBuilder;
  public readonly audio: AudioBuilder;
  public readonly speech: SpeechBuilder;
  public readonly moderation: ModerationBuilder;

  private providerAdapter: IExtendedProvider;

  constructor(
    provider: Provider,
    config: AIConfig,
    http?: IPlatformHTTP
  ) {
    this.provider = provider;

    // Create provider adapter
    // Note: For now, we'll use a placeholder for the HTTP client
    // In a real implementation, this would be injected from the platform
    const httpClient = http || this.createDefaultHTTP();

    switch (provider) {
      case 'openai':
        this.providerAdapter = new OpenAIAdapter(
          httpClient,
          config.apiKey,
          config.baseUrl,
          config.customHeaders
        ) as unknown as IExtendedProvider;
        break;

      case 'anthropic':
        this.providerAdapter = new AnthropicAdapter(
          httpClient,
          config.apiKey,
          {
            baseUrl: config.baseUrl,
            customHeaders: config.customHeaders,
            defaultMaxTokens: config.defaultMaxTokens,
          }
        ) as unknown as IExtendedProvider;
        break;

      case 'gemini':
        this.providerAdapter = new GeminiAdapter(
          httpClient,
          config.apiKey,
          config.baseUrl,
          config.customHeaders
        ) as unknown as IExtendedProvider;
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Create builders
    this.chat = new ChatBuilderWithUtils(this.providerAdapter, provider);
    this.embedding = new EmbeddingBuilder(this.providerAdapter, provider);
    this.image = new ImageBuilder(this.providerAdapter, provider);
    this.audio = new AudioBuilder(this.providerAdapter, provider);
    this.speech = new SpeechBuilder(this.providerAdapter, provider);
    this.moderation = new ModerationBuilder(this.providerAdapter, provider);
  }

  /**
   * Create a default HTTP client (placeholder)
   * In production, this would be injected from the platform layer
   */
  private createDefaultHTTP(): IPlatformHTTP {
    // This is a placeholder implementation
    // In a real app, the HTTP client would be provided by the platform
    throw new Error(
      'HTTP client not provided. Please pass an IPlatformHTTP instance to the AI constructor.'
    );
  }
}
