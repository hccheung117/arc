import { useCallback } from 'react'
import type { Message } from '@renderer/lib/messages'
import { prepareStreamContext, startAIStream } from '@renderer/lib/messages'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'
import { streamManager } from '@renderer/stores/stream-manager'
import { getStreamingMessage } from '@renderer/lib/stream-state'
import type { Prompt } from '@main/modules/threads/json-file'

/** Streaming message display type returned by getStreamingMessage */
type StreamingMessageDisplay = ReturnType<typeof getStreamingMessage>

interface UseStreamingStoreReturn {
  /** Whether currently streaming */
  isStreaming: boolean
  /** Streaming message for display (null if not streaming) */
  streamingMessage: StreamingMessageDisplay
  /** Start a new stream */
  start: (providerId: string, modelId: string, prompt: Prompt, onComplete: (message: Message) => void) => Promise<string>
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
 * Orchestrates: gathers context → calls ai.stream → registers with manager.
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
    async (providerId: string, modelId: string, prompt: Prompt, onComplete: (message: Message) => void) => {
      // Orchestration: gather all data from modules
      const ctx = await prepareStreamContext(prompt, threadId, providerId, modelId, parentId)
      // Call pure AI module with pre-gathered context
      const { streamId } = await startAIStream(ctx)
      // Register with stream manager for event routing and persistence
      streamManager.registerStream(
        streamId,
        threadId,
        modelId,
        ctx.providerId,
        ctx.parentId,
        onComplete,
      )
      return streamId
    },
    [threadId, parentId],
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
