/**
 * AI Library Types
 *
 * Public types for OpenAI-compatible chat completions.
 */

export const OPENAI_BASE_URL = 'https://api.openai.com/v1'

// ============================================================================
// INPUT
// ============================================================================

export interface TextPart {
  type: 'text'
  text: string
}

export interface ImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export type MessageContent = string | (TextPart | ImagePart)[]

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: MessageContent
}

export interface StreamOptions {
  baseUrl: string
  apiKey?: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
  signal?: AbortSignal
}

// ============================================================================
// OUTPUT
// ============================================================================

export interface Usage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens?: number
}

export type FinishReason = 'stop' | 'length' | 'content-filter' | 'error' | 'unknown'

export type StreamEvent =
  | { type: 'content'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'done'; finishReason: FinishReason }
