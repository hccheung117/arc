import { randomUUID } from 'crypto'
import type { WebContents } from 'electron'
import { eq } from 'drizzle-orm'
import type { Message } from '@arc/contracts/src/messages'
import { db } from '@/db/client'
import { conversations, messages, models, providers } from '@/db/schema'
import { getMessages } from './handlers'
import { getProviderConfig } from '@/core/providers/handlers'
import { streamChatCompletion, toCoreMessages, type ProviderConfig } from '@/core/ai/service'

// Track active streams for cancellation support
const activeStreams = new Map<string, AbortController>()

let nextId = 1

async function ensureConversationExists(conversationId: string): Promise<void> {
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)

  if (existing.length === 0) {
    const now = new Date().toISOString()
    await db.insert(conversations).values({
      id: conversationId,
      title: null,
      createdAt: now,
      updatedAt: now,
    })
  }
}

async function insertUserMessage(conversationId: string, content: string): Promise<Message> {
  await ensureConversationExists(conversationId)

  const now = new Date().toISOString()
  const messageId = String(nextId++)

  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'user',
    content,
    createdAt: now,
    updatedAt: now,
  })

  return {
    id: messageId,
    conversationId,
    role: 'user',
    status: 'complete',
    content,
    createdAt: now,
    updatedAt: now,
  }
}

async function insertAssistantMessage(conversationId: string, content: string): Promise<Message> {
  const now = new Date().toISOString()
  const messageId = String(nextId++)

  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'assistant',
    content,
    createdAt: now,
    updatedAt: now,
  })

  return {
    id: messageId,
    conversationId,
    role: 'assistant',
    status: 'complete',
    content,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Get provider ID for a given model
 */
async function getModelProvider(modelId: string): Promise<string> {
  const result = await db
    .select({ providerId: models.providerId })
    .from(models)
    .where(eq(models.id, modelId))
    .get()

  if (!result) {
    throw new Error(`Model ${modelId} not found`)
  }

  return result.providerId
}

/**
 * Initiate message streaming
 * Returns streamId and userMessageId immediately
 */
export async function streamMessage(
  sender: WebContents,
  conversationId: string,
  modelId: string,
  content: string,
): Promise<{ streamId: string; messageId: string }> {
  const streamId = randomUUID()
  const userMessage = await insertUserMessage(conversationId, content)

  // Start streaming in background (non-blocking)
  startStreaming(sender, streamId, conversationId, modelId).catch((error) => {
    console.error('Stream error:', error)
    sender.send('message-stream:error', {
      streamId,
      error: error instanceof Error ? error.message : 'Unknown streaming error',
    })
  })

  return { streamId, messageId: userMessage.id }
}

/**
 * Background streaming process
 */
async function startStreaming(
  sender: WebContents,
  streamId: string,
  conversationId: string,
  modelId: string,
): Promise<void> {
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  try {
    // Get conversation history
    const conversationMessages = await getMessages(conversationId)

    // Get provider for model
    const providerId = await getModelProvider(modelId)
    const config = await getProviderConfig(providerId)

    // Get provider type
    const provider = await db
      .select({ type: providers.type })
      .from(providers)
      .where(eq(providers.id, providerId))
      .get()

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    const providerConfig: ProviderConfig = {
      type: provider.type,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    }

    // Convert messages to AI SDK format
    const coreMessages = toCoreMessages(conversationMessages)

    // Start streaming
    const result = await streamChatCompletion(
      providerConfig,
      modelId,
      coreMessages,
      abortController.signal,
    )

    let fullContent = ''

    // Stream text deltas
    for await (const textPart of result.textStream) {
      fullContent += textPart
      sender.send('message-stream:delta', {
        streamId,
        chunk: textPart,
      })
    }

    // Save complete assistant message to database
    const assistantMessage = await insertAssistantMessage(conversationId, fullContent)

    // Send completion event
    sender.send('message-stream:complete', {
      streamId,
      message: assistantMessage,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // Stream was cancelled, don't send error
      return
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    sender.send('message-stream:error', {
      streamId,
      error: errorMessage,
    })
  } finally {
    activeStreams.delete(streamId)
  }
}

/**
 * Cancel an active stream
 */
export function cancelStream(streamId: string): void {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}
