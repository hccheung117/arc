import type { IpcMain } from 'electron'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'
import type { ChatOptions, ChatResponse, AIStreamEvent } from '@arc-types/arc-api'
import { ChatOptionsSchema } from '@arc-types/arc-api'
import type { Model } from '@arc-types/models'
import { getModels } from '../lib/models'
import { startChatStream, cancelStream } from '../lib/ai'
import { error } from '../lib/logger'
import { validated, broadcast } from '../lib/ipc'

// ============================================================================
// AI STREAM EVENTS
// ============================================================================

function emitAIStreamEvent(event: AIStreamEvent): void {
  broadcast('arc:ai:event', event)
}

// ============================================================================
// MODELS
// ============================================================================

async function handleModelsList(): Promise<Model[]> {
  return getModels()
}

function registerModelsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:models:list', handleModelsList)
}

// ============================================================================
// AI STREAMING
// ============================================================================

const handleAIChat = validated(
  [z.string(), ChatOptionsSchema],
  async (conversationId, options): Promise<ChatResponse> => {
    const streamId = createId()

    startChatStream(streamId, conversationId, options.model, {
      onDelta: (chunk) => emitAIStreamEvent({ type: 'delta', streamId, chunk }),
      onReasoning: (chunk) => emitAIStreamEvent({ type: 'reasoning', streamId, chunk }),
      onComplete: (message) => emitAIStreamEvent({ type: 'complete', streamId, message }),
      onError: (error) => emitAIStreamEvent({ type: 'error', streamId, error }),
    }).catch((err) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown streaming error'
      error('chat', errorMsg, err as Error)
      emitAIStreamEvent({ type: 'error', streamId, error: errorMsg })
    })

    return { streamId }
  }
)

const handleAIStop = validated([z.string()], async (streamId) => {
  cancelStream(streamId)
})

function registerAIStreamHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ai:chat', handleAIChat)
  ipcMain.handle('arc:ai:stop', handleAIStop)
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

export function registerAIHandlers(ipcMain: IpcMain): void {
  registerModelsHandlers(ipcMain)
  registerAIStreamHandlers(ipcMain)
}
