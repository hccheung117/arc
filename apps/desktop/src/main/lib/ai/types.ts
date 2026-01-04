/**
 * AI Library Types
 *
 * Public types for OpenAI-compatible APIs.
 */

// ============================================================================
// INPUT
// ============================================================================

interface TextPart {
  type: 'text'
  text: string
}

interface ImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | (TextPart | ImagePart)[]
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
