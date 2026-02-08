import { useCallback } from 'react'
import { prepareStreamContext, startAIStream } from '@renderer/lib/messages'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'
import { streamManager } from '@renderer/stores/stream-manager'
import { getStreamingMessage } from '@renderer/lib/stream-state'

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
  threadId,
  parentId,
) {
  const streamState = useChatUIStore((state) => state.getThreadState(threadId).streaming)

  const start = useCallback(
    async (providerId, modelId, prompt, onComplete, parentIdOverride) => {
      // Use parentIdOverride if provided (the user message ID), otherwise fall back to parentId from closure
      const effectiveParentId = parentIdOverride ?? parentId
      // Orchestration: gather all data from modules
      const ctx = await prepareStreamContext(prompt, threadId, providerId, modelId, effectiveParentId)
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
