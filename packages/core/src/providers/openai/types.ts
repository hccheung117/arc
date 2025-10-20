/**
 * OpenAI API Types
 *
 * Minimal type definitions for OpenAI API
 * Based on https://platform.openai.com/docs/api-reference
 */

/**
 * Message role in a conversation
 */
export type OpenAIRole = "user" | "assistant" | "system";

/**
 * Message content (text or multimodal)
 */
export interface OpenAIMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string; // data URL or https URL
    detail?: "auto" | "low" | "high";
  };
}

/**
 * Chat message
 */
export interface OpenAIMessage {
  role: OpenAIRole;
  content: string | OpenAIMessageContent[];
  name?: string;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
}

/**
 * Choice in a chat completion response
 */
export interface ChatCompletionChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: "stop" | "length" | "content_filter" | "tool_calls" | null;
}

/**
 * Chat completion response (non-streaming)
 */
export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Delta in a streaming chunk
 */
export interface ChatCompletionDelta {
  role?: OpenAIRole;
  content?: string;
}

/**
 * Choice in a streaming chunk
 */
export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

/**
 * Streaming chunk from chat completion
 */
export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

/**
 * Model information
 */
export interface OpenAIModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

/**
 * List models response
 */
export interface ListModelsResponse {
  object: "list";
  data: OpenAIModel[];
}

/**
 * Error response from OpenAI API
 */
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}
