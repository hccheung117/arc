import type { ImageAttachment } from "./ImageAttachment.js";

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
 * Generic provider interface for AI chat completions
 *
 * All provider implementations (OpenAI, Anthropic, etc.) should implement this interface
 */
export interface IProvider {
  /**
   * List available models from this provider
   */
  listModels(): Promise<ModelInfo[]>;

  /**
   * Health check - verifies API key and connection
   *
   * @returns true if connection is healthy
   * @throws ProviderError if connection fails
   */
  healthCheck(): Promise<boolean>;

  /**
   * Stream chat completion
   *
   * @param messages - Array of messages (user/assistant/system)
   * @param model - Model to use
   * @param attachments - Optional image attachments for the latest message
   * @param signal - AbortSignal for cancellation
   * @returns AsyncGenerator yielding content chunks
   */
  streamChatCompletion(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    model: string,
    attachments?: ImageAttachment[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, undefined>;

  /**
   * Get capabilities for a specific model
   *
   * This allows Arc to understand what features are supported
   * and adapt the UI/UX accordingly
   *
   * @param model - Model identifier to check capabilities for
   * @returns Capabilities object describing supported features
   */
  getCapabilities(model: string): ProviderCapabilities;
}
