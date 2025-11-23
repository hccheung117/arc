import { randomUUID } from 'crypto'
import type { WebContents } from 'electron'
import { eq } from 'drizzle-orm'
import type { Message } from '../../types/messages'
import { db } from '../db/client'
import { conversations, messages, models, providers } from '../db/schema'
import { getMessages } from './handlers'
import { getProviderConfig } from '../providers/handlers'
import { streamChatCompletion, toCoreMessages, type ProviderConfig } from '../ai/service'

// Track active streams for cancellation support
const activeStreams = new Map<string, AbortController>()

/*
  Conversation-as-By-Product Philosophy:

  Conversations exist as a by-product of messages, not as pre-created containers.
  This function embodies that philosophy: it auto-creates conversation records on-demand
  when a message references a conversationId that doesn't exist yet.

  Flow:
  1. Client generates UUID client-side (no server roundtrip needed)
  2. User sends first message with that UUID
  3. This function checks if conversation exists
  4. If not, creates conversation record with null title (title emerges later from first message)
  5. Message is inserted
  6. Conversation now exists as a by-product of having messages

  Benefits:
  - No "create conversation first" API call needed
  - UUID generation is client-side (instant UX feedback)
  - Database has no foreign key constraints (messages drive conversation existence)
  - Conversations emerge naturally from the act of messaging
*/
async function ensureConversationExists(conversationId: string): Promise<void> {
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(conversations).values({
      id: conversationId,
      title: null, // Title will be derived from first message content when displayed
    })
  }
}

async function insertUserMessage(conversationId: string, content: string): Promise<Message> {
  // Auto-create conversation record if it doesn't exist (conversation-as-by-product)
  await ensureConversationExists(conversationId)

  const messageId = randomUUID()
  const now = new Date()

  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'user',
    content,
    createdAt: now,
    updatedAt: now,
  })

  const nowISO = now.toISOString()
  return {
    id: messageId,
    conversationId,
    role: 'user',
    status: 'complete',
    content,
    createdAt: nowISO,
    updatedAt: nowISO,
  }
}

async function insertAssistantMessage(conversationId: string, content: string): Promise<Message> {
  const messageId = randomUUID()
  const now = new Date()

  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'assistant',
    content,
    createdAt: now,
    updatedAt: now,
  })

  const nowISO = now.toISOString()
  return {
    id: messageId,
    conversationId,
    role: 'assistant',
    status: 'complete',
    content,
    createdAt: nowISO,
    updatedAt: nowISO,
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
    const errorMsg = error instanceof Error ? error.message : 'Unknown streaming error'
    console.error(`[Stream] Error: ${errorMsg}`)
    sender.send('message-stream:error', {
      streamId,
      error: errorMsg,
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
    const conversationMessages = await getMessages(conversationId)
    const providerId = await getModelProvider(modelId)
    const config = await getProviderConfig(providerId)
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

    const coreMessages = toCoreMessages(conversationMessages)
    const result = await streamChatCompletion(
      providerConfig,
      modelId,
      coreMessages,
      abortController.signal,
    )

    let fullContent = ''
    let chunkCount = 0

    // Stream text deltas
    for await (const textPart of result.textStream) {
      chunkCount++
      fullContent += textPart
      if (chunkCount === 1 || chunkCount % 10 === 0) {
        console.log(`[Stream] chunk ${chunkCount} (+${textPart.length} chars, total: ${fullContent.length})`)
      }
      sender.send('message-stream:delta', {
        streamId,
        chunk: textPart,
      })
    }

    if (chunkCount === 0) {
      console.warn('[Stream] Completed with 0 chunks')
    } else {
      console.log(`[Stream] Complete: ${chunkCount} chunks, ${fullContent.length} chars`)
    }

    const assistantMessage = await insertAssistantMessage(conversationId, fullContent)
    sender.send('message-stream:complete', {
      streamId,
      message: assistantMessage,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return // Stream was cancelled
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const apiError = error as any
    if (apiError.statusCode && apiError.responseBody) {
      console.error(`[Stream] ${apiError.statusCode}: ${apiError.responseBody}`)
    } else {
      console.error(`[Stream] Error: ${errorMsg}`)
    }

    sender.send('message-stream:error', {
      streamId,
      error: errorMsg,
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
