import type {
  Provider,
  ProviderType,
  AIConfig,
  ChatMessage,
  ChatChunk,
  ChatResult,
  ModelInfo,
  ProviderCapabilities,
  ImageAttachment,
} from "./provider.type.js";
import type { PlatformHTTP } from "@arc/platform/contracts/http.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GeminiProvider } from "./providers/gemini.js";

/**
 * Cancellable stream wrapper
 */
export interface CancellableStream<T> extends AsyncIterable<T> {
  /**
   * Cancel the stream
   */
  cancel(): void;
}

/**
 * Create a cancellable stream from an async generator
 */
function createCancellableStream<T>(
  generatorFn: (signal: AbortSignal) => AsyncGenerator<T, void, undefined>
): CancellableStream<T> {
  const controller = new AbortController();
  const generator = generatorFn(controller.signal);

  return {
    [Symbol.asyncIterator]() {
      return generator;
    },
    cancel() {
      controller.abort();
    },
  };
}

/**
 * Fluent chat builder interface
 */
export interface ChatBuilder {
  /**
   * Set the model to use for this chat
   */
  model(model: string): ChatBuilder;

  /**
   * Add a system message to the conversation
   */
  systemSays(content: string): ChatBuilder;

  /**
   * Add a user message to the conversation
   */
  userSays(content: string, options?: { images?: ImageAttachment[] }): ChatBuilder;

  /**
   * Add an assistant message to the conversation
   */
  assistantSays(content: string): ChatBuilder;

  /**
   * Generate a non-streaming chat completion
   */
  generate(): Promise<ChatResult>;

  /**
   * Stream a chat completion
   */
  stream(): CancellableStream<ChatChunk>;

  /**
   * List available models
   */
  models(): Promise<ModelInfo[]>;

  /**
   * Perform a health check on the provider
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get capabilities for a specific model
   */
  capabilities(model: string): ProviderCapabilities;
}

/**
 * Internal chat builder implementation
 */
class ChatBuilderImpl implements ChatBuilder {
  private messages: ChatMessage[] = [];
  private selectedModel?: string;

  constructor(
    private provider: Provider,
    private providerType: ProviderType
  ) {}

  model(model: string): ChatBuilder {
    this.selectedModel = model;
    return this;
  }

  systemSays(content: string): ChatBuilder {
    this.messages.push({ role: "system", content });
    return this;
  }

  userSays(content: string, options?: { images?: ImageAttachment[] }): ChatBuilder {
    this.messages.push({
      role: "user",
      content,
      images: options?.images,
    });
    return this;
  }

  assistantSays(content: string): ChatBuilder {
    this.messages.push({ role: "assistant", content });
    return this;
  }

  async generate(): Promise<ChatResult> {
    this.validateState();

    return this.provider.generateChatCompletion(
      this.messages,
      this.selectedModel!
    );
  }

  stream(): CancellableStream<ChatChunk> {
    this.validateState();

    const provider = this.provider;
    const messages = this.messages;
    const model = this.selectedModel!;

    return createCancellableStream((signal) => {
      return provider.streamChatCompletion(messages, model, { signal });
    });
  }

  async models(): Promise<ModelInfo[]> {
    return this.provider.listModels();
  }

  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }

  capabilities(model: string): ProviderCapabilities {
    return this.provider.getCapabilities(model);
  }

  private validateState(): void {
    if (!this.selectedModel) {
      throw new Error("Model must be set before generating (call .model() first)");
    }
    if (this.messages.length === 0) {
      throw new Error("At least one message must be added before generating");
    }
  }
}

/**
 * Main AI class - entry point for all AI operations
 *
 * Provides a fluent API for interacting with various AI providers.
 *
 * @example
 * ```typescript
 * // Create an AI instance
 * const ai = new AI('openai', { apiKey: '...' }, http);
 *
 * // Simple streaming chat
 * for await (const chunk of ai.chat
 *   .model('gpt-4')
 *   .userSays('Hello!')
 *   .stream()) {
 *   console.log(chunk);
 * }
 *
 * // Non-streaming chat with conversation history
 * const result = await ai.chat
 *   .model('gpt-4')
 *   .systemSays('You are a helpful assistant')
 *   .userSays('What is 2+2?')
 *   .assistantSays('2+2 equals 4')
 *   .userSays('What about 3+3?')
 *   .generate();
 * ```
 */
export class AI {
  public readonly provider: Provider;
  public readonly chat: ChatBuilder;

  /**
   * Create an AI instance with the specified provider
   *
   * @param providerType - The type of provider to create ('openai', 'anthropic', 'gemini')
   * @param config - Configuration for the provider (API key, base URL, etc.)
   * @param http - Platform HTTP client
   */
  constructor(
    providerType: ProviderType,
    config: AIConfig,
    http: PlatformHTTP
  ) {
    let provider: Provider;

    switch (providerType) {
      case "openai":
        provider = new OpenAIProvider(http, config);
        break;
      case "anthropic":
        provider = new AnthropicProvider(http, config);
        break;
      case "gemini":
        provider = new GeminiProvider(http, config);
        break;
      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }

    this.provider = provider;
    this.chat = new ChatBuilderImpl(provider, providerType);
  }
}
