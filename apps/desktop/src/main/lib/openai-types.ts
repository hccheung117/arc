/**
 * OpenAI Chat Completions API Types
 *
 * Minimal type definitions for direct REST API integration.
 * Supports both standard content and reasoning content (extended thinking).
 */

// ============================================================================
// REQUEST TYPES
// ============================================================================

/** Text content part for multimodal messages */
export interface TextContentPart {
  type: 'text'
  text: string
}

/** Image content part with base64 data URL */
export interface ImageContentPart {
  type: 'image_url'
  image_url: {
    url: string // data:image/png;base64,... or https://...
  }
}

/** Union of content part types */
export type ContentPart = TextContentPart | ImageContentPart

/** Chat message with role and content (simple or multimodal) */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentPart[]
}

/** Reasoning/thinking configuration */
export interface ThinkingConfig {
  reasoning_effort: 'low' | 'medium' | 'high'
}

/** Chat completion request payload */
export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  stream: boolean
  temperature?: number
  thinking?: ThinkingConfig
}

// ============================================================================
// RESPONSE TYPES (SSE Streaming)
// ============================================================================

/** Delta content in a streaming chunk */
export interface StreamDelta {
  role?: 'assistant'
  content?: string | null
  reasoning_content?: string | null
}

/** Choice in a streaming response */
export interface StreamChoice {
  index: number
  delta: StreamDelta
  finish_reason?: 'stop' | 'length' | 'content_filter' | null
}

/** Token usage statistics (appears in final chunk) */
export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

/** Streaming chunk response */
export interface ChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: StreamChoice[]
  usage?: TokenUsage
}

/** API error response */
export interface APIErrorResponse {
  error: {
    message: string
    type: string
    code: string | null
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Unified usage format matching storage schema */
export interface NormalizedUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens?: number
}
