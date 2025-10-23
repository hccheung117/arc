/**
 * Token usage information
 */
export interface Usage {
  /** Number of tokens in the prompt */
  promptTokens: number;
  /** Number of tokens in the completion */
  completionTokens: number;
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
}

/**
 * Reason why the model stopped generating
 */
export type FinishReason =
  | 'stop'        // Natural stop point
  | 'length'      // Max tokens reached
  | 'content_filter' // Content filtered
  | 'tool_calls'  // Tool/function call
  | 'cancel';     // Cancelled by user

/**
 * Supported AI provider types
 */
export type Provider = 'openai' | 'anthropic' | 'gemini';

/**
 * Base metadata included in all AI responses
 */
export interface BaseMetadata {
  /** The model that generated this response */
  model: string;
  /** The provider that served this request */
  provider: Provider;
}
