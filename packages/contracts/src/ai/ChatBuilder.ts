import type { ChatResult, ChatChunk } from './Results.js';
import type { CancellableStream } from './Streams.js';
import type { ImageAttachment } from '../ImageAttachment.js';

/**
 * Message in a conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ImageAttachment[];
}

/**
 * Model configuration options for chat
 */
export interface ChatModelOptions {
  /** Temperature (0-2, higher = more random) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling (0-1) */
  topP?: number;
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty?: number;
  /** Presence penalty (-2 to 2) */
  presencePenalty?: number;
  /** Stop sequences */
  stop?: string[];
}

/**
 * Fluent builder interface for chat completions
 *
 * Usage:
 * ```typescript
 * const result = await ai.chat
 *   .model('gpt-4')
 *   .userSays('Hello')
 *   .generate();
 * ```
 */
export interface IChatBuilder {
  /**
   * Set the model to use
   *
   * @param model - Model identifier (e.g., 'gpt-4', 'claude-3-5-sonnet')
   * @param options - Optional model configuration
   */
  model(model: string, options?: ChatModelOptions): IChatBuilder;

  /**
   * Add a system message
   *
   * @param content - The system message content
   */
  systemSays(content: string): IChatBuilder;

  /**
   * Add a user message
   *
   * @param content - The user message content
   * @param options - Optional message options (e.g., images)
   */
  userSays(content: string, options?: { images?: ImageAttachment[] }): IChatBuilder;

  /**
   * Add an assistant message
   *
   * Used for multi-turn conversations to provide context
   *
   * @param content - The assistant message content
   */
  assistantSays(content: string): IChatBuilder;

  /**
   * Clone this builder to create a branching conversation
   *
   * Useful for trying different continuations from the same base
   *
   * @returns A new builder with the same messages
   */
  clone(): IChatBuilder;

  /**
   * Generate a completion (non-streaming)
   *
   * @returns Promise that resolves to the complete result
   */
  generate(): Promise<ChatResult>;

  /**
   * Stream a completion
   *
   * @returns A cancellable async iterable of chunks
   */
  stream(): CancellableStream<ChatChunk>;
}
