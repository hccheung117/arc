import { useCallback } from 'react'
import type { Message } from '@renderer/lib/messages'
import { startAIChat } from '@renderer/lib/messages'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'
import { streamManager } from '@renderer/stores/stream-manager'
import { getStreamingMessage } from '@renderer/lib/stream-state'

/** Streaming message display type returned by getStreamingMessage */
type StreamingMessageDisplay = ReturnType<typeof getStreamingMessage>

interface UseStreamingStoreReturn {
  /** Whether currently streaming */
  isStreaming: boolean
  /** Streaming message for display (null if not streaming) */
  streamingMessage: StreamingMessageDisplay
  /** Start a new stream */
  start: (modelId: string, onComplete: (message: Message) => void) => Promise<string>
  /** Stop the current stream */
  stop: () => void
  /** Reset to idle state */
  reset: () => void
}

/**
 * Store-backed streaming hook
 *
 * Reads streaming state from the global store, delegates stream management
 * to the stream-manager. Stream continues even when switching tabs.
 *
 * @param threadId - The thread ID
 * @param parentId - Parent message ID for the streaming message display
 */
export function useStreamingStore(
  threadId: string,
  parentId: string | null,
): UseStreamingStoreReturn {
  const streamState = useChatUIStore((state) => state.getThreadState(threadId).streaming)

  const start = useCallback(
    async (modelId: string, onComplete: (message: Message) => void) => {
      const { streamId } = await startAIChat(threadId, modelId)
      streamManager.registerStream(streamId, threadId, onComplete)
      return streamId
    },
    [threadId],
  )

  const stop = useCallback(() => {
    streamManager.stopStream(threadId)
  }, [threadId])

  const reset = useCallback(() => {
    useChatUIStore.getState().resetStream(threadId)
  }, [threadId])

  const streamingMessage = getStreamingMessage(streamState, threadId, parentId)

  return {
    isStreaming: streamState.status === 'streaming',
    streamingMessage,
    start,
    stop,
    reset,
  }
}
