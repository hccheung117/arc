/**
 * Image attachment for vision-capable models
 */
export interface ImageAttachment {
  /**
   * Base64-encoded image data (with or without data URI prefix)
   */
  data: string;

  /**
   * MIME type of the image (e.g., 'image/jpeg', 'image/png')
   */
  mimeType: string;
}

/**
 * Message in a conversation
 */
export interface ChatMessage {
  /**
   * Role of the message sender
   */
  role: "user" | "assistant" | "system";

  /**
   * Text content of the message
   */
  content: string;

  /**
   * Optional image attachments (for vision-capable models)
   * Only applicable to user messages
   */
  images?: ImageAttachment[];
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /**
   * Number of tokens in the prompt/input
   */
  promptTokens: number;

  /**
   * Number of tokens in the completion/output
   */
  completionTokens: number;

  /**
   * Total tokens used (prompt + completion)
   */
  totalTokens: number;
}

/**
 * Streaming chunk from chat completion
 */
export interface ChatChunk {
  /**
   * Incremental content (may be empty string)
   */
  content: string;

  /**
   * Optional metadata (present in final chunk)
   */
  metadata?: {
    model: string;
    provider: string;
    usage?: TokenUsage;
    finishReason?: "stop" | "length" | "content_filter" | "function_call";
  };
}

/**
 * Complete result from non-streaming chat
 */
export interface ChatResult {
  /**
   * Full response content
   */
  content: string;

  /**
   * Metadata about the completion
   */
  metadata: {
    model: string;
    provider: string;
    usage?: TokenUsage;
    finishReason?: "stop" | "length" | "content_filter" | "function_call";
  };
}

/**
 * Model information from a provider
 */
export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * Provider capabilities - describes what features a provider/model supports
 */
export interface ProviderCapabilities {
  /**
   * Whether the model supports vision/image inputs
   */
  supportsVision: boolean;

  /**
   * Whether the provider supports streaming responses
   */
  supportsStreaming: boolean;

  /**
   * Whether max_tokens parameter is required
   */
  requiresMaxTokens: boolean;

  /**
   * Default max_tokens value if required
   */
  maxTokensDefault?: number;

  /**
   * Supported message roles for this provider
   * e.g., ["user", "assistant", "system"] for OpenAI
   * e.g., ["user", "assistant"] for Anthropic (system is separate)
   */
  supportedMessageRoles: string[];
}

/**
 * Core Provider interface for AI chat completions
 *
 * All provider implementations (OpenAI, Anthropic, Gemini) must implement this interface.
 * This contract is owned by @arc/ai and defines the expected behavior for all providers.
 */
export interface Provider {
  /**
   * List available models from this provider
   *
   * @returns Array of model information
   * @throws {ProviderAuthError} If API key is invalid
   * @throws {ProviderTimeoutError} If request times out
   * @throws {ProviderServerError} If provider server error occurs
   */
  listModels(): Promise<ModelInfo[]>;

  /**
   * Health check - verifies API key and connection
   *
   * @returns true if connection is healthy
   * @throws {ProviderAuthError} If API key is invalid
   * @throws {ProviderTimeoutError} If request times out
   * @throws {ProviderServerError} If provider server error occurs
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get capabilities for a specific model
   *
   * This allows the consuming layer to understand what features are supported
   * and adapt the UX accordingly (e.g., show image upload for vision models)
   *
   * @param model - Model identifier to check capabilities for
   * @returns Capabilities object describing supported features
   */
  getCapabilities(model: string): ProviderCapabilities;

  /**
   * Stream chat completion
   *
   * Yields incremental content chunks as they arrive from the provider.
   * The final chunk will include complete metadata with token usage.
   *
   * @param messages - Array of conversation messages
   * @param model - Model to use for completion
   * @param options - Optional streaming options
   * @returns AsyncGenerator yielding chat chunks
   * @throws {ProviderAuthError} If API key is invalid
   * @throws {ProviderRateLimitError} If rate limit is exceeded
   * @throws {ProviderTimeoutError} If request times out
   * @throws {ProviderQuotaExceededError} If quota is exhausted
   * @throws {ModelNotFoundError} If model doesn't exist
   * @throws {ProviderInvalidRequestError} If request parameters are invalid
   * @throws {RequestCancelledError} If request is cancelled via signal
   */
  streamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: {
      /**
       * AbortSignal for request cancellation
       */
      signal?: AbortSignal;
    }
  ): AsyncGenerator<ChatChunk, void, undefined>;

  /**
   * Non-streaming chat completion
   *
   * Returns the complete response after all content has been generated.
   * Internally may use streaming and collect all chunks.
   *
   * @param messages - Array of conversation messages
   * @param model - Model to use for completion
   * @param options - Optional completion options
   * @returns Complete chat result with content and metadata
   * @throws {ProviderAuthError} If API key is invalid
   * @throws {ProviderRateLimitError} If rate limit is exceeded
   * @throws {ProviderTimeoutError} If request times out
   * @throws {ProviderQuotaExceededError} If quota is exhausted
   * @throws {ModelNotFoundError} If model doesn't exist
   * @throws {ProviderInvalidRequestError} If request parameters are invalid
   * @throws {RequestCancelledError} If request is cancelled via signal
   */
  generateChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: {
      /**
       * AbortSignal for request cancellation
       */
      signal?: AbortSignal;
    }
  ): Promise<ChatResult>;
}

/**
 * Provider type identifier
 */
export type ProviderType = "openai" | "anthropic" | "gemini" | "custom";

/**
 * Configuration for AI provider
 */
export interface AIConfig {
  /**
   * API key for the provider
   */
  apiKey: string;

  /**
   * Optional custom base URL (for proxies or compatible APIs)
   */
  baseUrl?: string;

  /**
   * Optional custom headers to include in all requests
   */
  customHeaders?: Record<string, string>;

  /**
   * Optional default max tokens for providers that require it (e.g., Anthropic)
   */
  defaultMaxTokens?: number;
}
