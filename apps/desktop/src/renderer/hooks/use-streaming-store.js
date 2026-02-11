import { useCallback } from 'react'
import { startAIStream } from '@renderer/lib/messages'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'
import { streamManager } from '@renderer/stores/stream-manager'
import { getStreamingMessage } from '@renderer/lib/stream-state'

// ============================================================================
// Private helpers for stream context preparation
// ============================================================================

async function getLastMessageId(threadId) {
  const { messages } = await window.arc.messages.list({ threadId })
  return messages.at(-1)?.id ?? null
}

async function convertToAIMessages(
  messages,
  threadId,
) {
  return Promise.all(
    messages.map(async (message) => {
      if (message.role === 'user' && message.attachments?.length) {
        const imageResults = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await window.arc.messages.readAttachment({ threadId, filename: att.path })
            if (!buffer) return null
            const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
            const base64 = btoa(String.fromCharCode(...bytes))
            return {
              type: 'image',
              image: `data:${att.mimeType};base64,${base64}`,
              mediaType: att.mimeType,
            }
          }),
        )
        const imageParts = imageResults.filter((p) => p !== null)
        return {
          role: 'user',
          content: [...imageParts, { type: 'text', text: message.content }],
        }
      }

      return {
        role: message.role,
        content: message.content,
      }
    }),
  )
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
  threadId,
  parentId,
) {
  const streamState = useChatUIStore((state) => state.getThreadState(threadId).streaming)

  const start = useCallback(
    async (providerId, modelId, prompt, onComplete, parentIdOverride) => {
      // Use parentIdOverride if provided (the user message ID), otherwise fall back to parentId from closure
      const effectiveParentId = parentIdOverride ?? parentId
      
      // Orchestration: gather all data from modules (parallel IPC calls)
      const [messagesResult, streamConfig, systemPrompt] = await Promise.all([
        effectiveParentId
          ? window.arc.messages.getConversation({ threadId, leafMessageId: effectiveParentId })
          : window.arc.messages.list({ threadId }).then((r) => convertToAIMessages(r.messages, threadId)),
        window.arc.settings.getActiveProfileId().then(profileId => {
          if (!profileId) throw new Error('No active profile')
          return window.arc.profiles.getStreamConfig({ profileId, providerId, modelId })
        }),
        window.arc.personas.resolve({ prompt }),
      ])

      // Derive parentId: use provided effectiveParentId, or last message from fetched list
      const resolvedParentId = effectiveParentId ?? (messagesResult.length > 0 ? await getLastMessageId(threadId) : null)

      const ctx = {
        provider: { baseURL: streamConfig.baseURL ?? undefined, apiKey: streamConfig.apiKey ?? undefined },
        modelId: streamConfig.modelId,
        systemPrompt,
        messages: messagesResult,
        parentId: resolvedParentId,
        threadId,
        providerId: streamConfig.providerId,
      }

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
