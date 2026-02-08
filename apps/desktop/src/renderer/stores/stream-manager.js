import {
  onAIDelta,
  onAIReasoning,
  onAIComplete,
  onAIError,
  stopAIChat,
  createMessage,
} from '@renderer/lib/messages'
import { error as logError } from '@renderer/lib/logger'
import { useChatUIStore } from './chat-ui-store'

/**
 * Stream Manager - Global stream subscription handler
 *
 * Solves the tab-switch stream continuity problem:
 * - Old model: useStreaming subscribed in useEffect, cleanup cancelled stream on unmount
 * - New model: Single global subscription routes events to store by streamId→threadId
 *
 * Stream continues regardless of which thread is visible.
 * On completion, persists the assistant message via messages module.
 */
class StreamManager {
  streams = new Map()
  unsubscribes = []
  initialized = false

  /**
   * Initialize the global stream subscriptions
   *
   * Call once on app startup (e.g., in workbench.tsx).
   * Safe to call multiple times - will only subscribe once.
   */
  init() {
    if (this.initialized) return
    this.initialized = true

    this.unsubscribes.push(
      onAIDelta(({ streamId, chunk }) => {
        const reg = this.streams.get(streamId)
        if (!reg) return
        useChatUIStore.getState().applyDelta(reg.threadId, chunk)
      }),

      onAIReasoning(({ streamId, chunk }) => {
        const reg = this.streams.get(streamId)
        if (!reg) return
        useChatUIStore.getState().applyReasoning(reg.threadId, chunk)
      }),

      onAIComplete((data) => {
        const reg = this.streams.get(data.streamId)
        if (!reg) return

        useChatUIStore.getState().completeStream(reg.threadId)
        this.persistAndCallback(data, reg)
        this.streams.delete(data.streamId)
      }),

      onAIError(({ streamId, error }) => {
        const reg = this.streams.get(streamId)
        if (!reg) return

        logError('stream-manager', `Stream error: ${error}`)
        useChatUIStore.getState().failStream(reg.threadId, error)
        this.streams.delete(streamId)
      }),
    )
  }

  /**
   * Persist the completed assistant message and invoke callback
   */
  async persistAndCallback(data, reg) {
    try {
      const message = await createMessage(
        reg.threadId,
        'assistant',
        data.content,
        reg.parentId,
        reg.modelId,
        reg.providerId,
        undefined, // no attachments for assistant
        data.reasoning || undefined,
        data.usage,
      )
      reg.onComplete(message)
    } catch (err) {
      logError('stream-manager', 'Failed to persist assistant message', err)
      useChatUIStore.getState().failStream(reg.threadId, 'Failed to save response')
    }
  }

  /**
   * Register a new stream
   *
   * Called when starting a stream. Maps streamId to context so events
   * can be routed and completion can persist the message.
   */
  registerStream(
    streamId,
    threadId,
    modelId,
    providerId,
    parentId,
    onComplete,
  ) {
    this.streams.set(streamId, { threadId, modelId, providerId, parentId, onComplete })
    useChatUIStore.getState().startStream(threadId, streamId)
  }

  /**
   * Stop a stream for a thread
   *
   * Called when user clicks stop or navigates away while streaming.
   * Cleans up the mapping and calls stopAIChat.
   */
  stopStream(threadId) {
    const state = useChatUIStore.getState().getThreadState(threadId)
    if (state.streaming.status !== 'streaming') return

    const streamId = state.streaming.id
    stopAIChat(streamId)
    useChatUIStore.getState().resetStream(threadId)

    this.streams.delete(streamId)
  }

  /**
   * Check if a thread has an active stream
   */
  isStreaming(threadId) {
    const state = useChatUIStore.getState().getThreadState(threadId)
    return state.streaming.status === 'streaming'
  }

  /**
   * Get the stream ID for a thread (if streaming)
   */
  getStreamId(threadId) {
    const state = useChatUIStore.getState().getThreadState(threadId)
    if (state.streaming.status === 'streaming') {
      return state.streaming.id
    }
    return null
  }

  /**
   * Cleanup - called on app shutdown
   */
  destroy() {
    for (const unsub of this.unsubscribes) {
      unsub()
    }
    this.unsubscribes = []
    this.streams.clear()
    this.initialized = false
  }
}

// Singleton instance
export const streamManager = new StreamManager()
