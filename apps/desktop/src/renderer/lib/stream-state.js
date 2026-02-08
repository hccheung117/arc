/**
 * Create a new streaming state
 */
export function createStream(id) {
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
export function applyDelta(state, chunk) {
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
export function applyReasoning(state, chunk) {
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
export function completeStream(message) {
  return {
    status: 'complete',
    message,
  }
}

/**
 * Fail the stream with an error
 */
export function failStream(error) {
  return {
    status: 'error',
    error,
  }
}

/**
 * Reset to idle state
 */
export function resetStream() {
  return { status: 'idle' }
}

/**
 * Get streaming message for display (or null if not streaming)
 */
export function getStreamingMessage(
  state,
  threadId,
  parentId,
) {
  if (state.status !== 'streaming') return null

  return {
    id: `streaming-${state.id}`,
    role: 'assistant',
    content: state.content,
    reasoning: state.reasoning,
    status: 'streaming',
    conversationId: threadId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parentId,
    isThinking: state.isThinking,
  }
}
