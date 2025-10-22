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
}
