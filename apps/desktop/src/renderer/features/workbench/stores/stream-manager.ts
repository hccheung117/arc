import type { Message } from '@renderer/lib/messages'
import { onAIEvent, stopAIChat, transformMessage } from '@renderer/lib/messages'
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
 */
class StreamManager {
  private streamToThread: Map<string, string> = new Map()
  private streamCallbacks: Map<string, (message: Message) => void> = new Map()
  private unsubscribe: (() => void) | null = null
  private initialized = false

  /**
   * Initialize the global stream subscription
   *
   * Call once on app startup (e.g., in workbench.tsx).
   * Safe to call multiple times - will only subscribe once.
   */
  init() {
    if (this.initialized) return
    this.initialized = true

    this.unsubscribe = onAIEvent((event) => {
      const threadId = this.streamToThread.get(event.streamId)
      if (!threadId) return

      switch (event.type) {
        case 'delta':
          useChatUIStore.getState().applyDelta(threadId, event.chunk)
          break

        case 'reasoning':
          useChatUIStore.getState().applyReasoning(threadId, event.chunk)
          break

        case 'complete': {
          useChatUIStore.getState().completeStream(threadId)

          // Call the completion callback to add message to tree
          const callback = this.streamCallbacks.get(event.streamId)
          if (callback) {
            // Transform stored message to UI message
            callback(transformMessage(event.message, threadId))
            this.streamCallbacks.delete(event.streamId)
          }

          this.streamToThread.delete(event.streamId)
          break
        }

        case 'error':
          logError('stream-manager', `Stream error: ${event.error}`)
          useChatUIStore.getState().failStream(threadId, event.error)
          this.streamToThread.delete(event.streamId)
          this.streamCallbacks.delete(event.streamId)
          break
      }
    })
  }

  /**
   * Register a new stream
   *
   * Called when starting a stream. Maps streamId to threadId so events
   * can be routed to the correct thread state.
   *
   * @param streamId - The stream ID returned from startAIChat
   * @param threadId - The thread this stream belongs to
   * @param onComplete - Callback to add the completed message to the tree
   */
  registerStream(streamId: string, threadId: string, onComplete: (message: Message) => void) {
    this.streamToThread.set(streamId, threadId)
    this.streamCallbacks.set(streamId, onComplete)
    useChatUIStore.getState().startStream(threadId, streamId)
  }

  /**
   * Stop a stream for a thread
   *
   * Called when user clicks stop or navigates away while streaming.
   * Cleans up the mapping and calls stopAIChat.
   */
  stopStream(threadId: string) {
    const state = useChatUIStore.getState().getThreadState(threadId)
    if (state.streaming.status !== 'streaming') return

    const streamId = state.streaming.id
    stopAIChat(streamId)
    useChatUIStore.getState().resetStream(threadId)

    this.streamToThread.delete(streamId)
    this.streamCallbacks.delete(streamId)
  }

  /**
   * Check if a thread has an active stream
   */
  isStreaming(threadId: string): boolean {
    const state = useChatUIStore.getState().getThreadState(threadId)
    return state.streaming.status === 'streaming'
  }

  /**
   * Get the stream ID for a thread (if streaming)
   */
  getStreamId(threadId: string): string | null {
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
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.streamToThread.clear()
    this.streamCallbacks.clear()
    this.initialized = false
  }
}

// Singleton instance
export const streamManager = new StreamManager()
