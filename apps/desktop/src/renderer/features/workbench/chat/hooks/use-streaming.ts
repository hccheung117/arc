import { useState, useEffect, useCallback } from 'react'
import type { Message } from '@arc-types/messages'
import type { StreamState } from '@renderer/features/workbench/chat/domain/types'
import {
  createStream,
  applyDelta,
  applyReasoning,
  completeStream,
  failStream,
  resetStream,
  getStreamingMessage,
} from '@renderer/features/workbench/chat/domain/stream-state'
import { startAIChat, stopAIChat, onAIEvent } from '@renderer/lib/messages'
import { error as logError } from '@renderer/lib/logger'

interface UseStreamingReturn {
  /** Current streaming state */
  streamState: StreamState
  /** Streaming message for display (null if not streaming) */
  streamingMessage: ReturnType<typeof getStreamingMessage>
  /** Whether currently streaming */
  isStreaming: boolean
  /** Start a new stream */
  start: (threadId: string, modelId: string) => Promise<string>
  /** Stop the current stream */
  stop: () => void
  /** Reset to idle state */
  reset: () => void
}

/**
 * Manage AI streaming lifecycle
 */
export function useStreaming(
  threadId: string,
  parentId: string | null,
  onComplete: (message: Message) => void,
): UseStreamingReturn {
  const [streamState, setStreamState] = useState<StreamState>({ status: 'idle' })

  // Subscribe to AI events when streaming
  useEffect(() => {
    if (streamState.status !== 'streaming') return

    const streamId = streamState.id

    const cleanup = onAIEvent((event) => {
      if (event.streamId !== streamId) return

      if (event.type === 'delta') {
        setStreamState((prev) => applyDelta(prev, event.chunk))
      } else if (event.type === 'reasoning') {
        setStreamState((prev) => applyReasoning(prev, event.chunk))
      } else if (event.type === 'complete') {
        setStreamState(completeStream(event.message))
        onComplete(event.message)
        // Reset to idle after processing complete
        setStreamState(resetStream())
      } else if (event.type === 'error') {
        logError('ui', `Stream error: ${event.error}`)
        setStreamState(failStream(event.error))
      }
    })

    return cleanup
  }, [streamState.status, streamState.status === 'streaming' ? streamState.id : null, onComplete])

  // Cancel stream on unmount
  useEffect(() => {
    return () => {
      if (streamState.status === 'streaming') {
        stopAIChat(streamState.id)
      }
    }
  }, [streamState])

  const start = useCallback(async (tid: string, modelId: string) => {
    const { streamId } = await startAIChat(tid, modelId)
    setStreamState(createStream(streamId))
    return streamId
  }, [])

  const stop = useCallback(() => {
    if (streamState.status === 'streaming') {
      stopAIChat(streamState.id)
      setStreamState(resetStream())
    }
  }, [streamState])

  const reset = useCallback(() => {
    setStreamState(resetStream())
  }, [])

  const streamingMessage = getStreamingMessage(streamState, threadId, parentId)

  return {
    streamState,
    streamingMessage,
    isStreaming: streamState.status === 'streaming',
    start,
    stop,
    reset,
  }
}
