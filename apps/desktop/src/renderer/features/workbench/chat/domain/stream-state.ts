import type { Message } from '@arc-types/messages'
import type { StreamState } from './types'

/**
 * Create a new streaming state
 */
export function createStream(id: string): StreamState {
  return {
    status: 'streaming',
    id,
    content: '',
    reasoning: '',
    isThinking: false,
  }
}

/**
 * Apply a content delta to the streaming state
 */
export function applyDelta(state: StreamState, chunk: string): StreamState {
  if (state.status !== 'streaming') return state

  return {
    ...state,
    content: state.content + chunk,
    isThinking: false,
  }
}

/**
 * Apply a reasoning delta to the streaming state
 */
export function applyReasoning(state: StreamState, chunk: string): StreamState {
  if (state.status !== 'streaming') return state

  return {
    ...state,
    reasoning: state.reasoning + chunk,
    isThinking: true,
  }
}

/**
 * Complete the stream with the final message
 */
export function completeStream(message: Message): StreamState {
  return {
    status: 'complete',
    message,
  }
}

/**
 * Fail the stream with an error
 */
export function failStream(error: string): StreamState {
  return {
    status: 'error',
    error,
  }
}

/**
 * Reset to idle state
 */
export function resetStream(): StreamState {
  return { status: 'idle' }
}

/**
 * Get streaming message for display (or null if not streaming)
 */
export function getStreamingMessage(state: StreamState, threadId: string, parentId: string | null) {
  if (state.status !== 'streaming') return null

  return {
    id: `streaming-${state.id}`,
    role: 'assistant' as const,
    content: state.content,
    reasoning: state.reasoning,
    status: 'streaming' as const,
    conversationId: threadId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parentId,
    isThinking: state.isThinking,
  }
}
