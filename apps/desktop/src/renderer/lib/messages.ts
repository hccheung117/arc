import type { Usage, Message as AIMessage } from '@main/modules/ai/business'
import type {
  AttachmentInput,
  BranchInfo,
  StoredMessageEvent,
  MessageRole,
} from '@main/modules/messages/business'
import type { Prompt } from '@main/modules/threads/json-file'

// ============================================================================
// RENDERER VIEW MODEL TYPES
// ============================================================================

/**
 * Message attachment with URL for display.
 *
 * This is a renderer ViewModel - IPC returns StoredAttachment (no url).
 * URL is generated during transformation based on conversationId.
 */
export interface MessageAttachment {
  type: 'image'
  path: string
  mimeType: string
  url: string
}

/**
 * Message ViewModel for UI rendering.
 *
 * This is a renderer ViewModel - IPC returns StoredMessageEvent (optional fields).
 * Key differences from IPC type:
 * - Has conversationId (derived from context)
 * - Has url on attachments (generated)
 * - Has status field (for streaming state)
 * - All fields required (defaults applied during transformation)
 */
export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  status: MessageStatus
  content: string
  reasoning?: string
  createdAt: string
  updatedAt: string
  parentId: string | null
  error?: Error
  attachments?: MessageAttachment[]
  model?: string
  provider?: string
}

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'failed'

export type { MessageRole }

// ============================================================================
// TRANSFORMATION
// ============================================================================

/**
 * Transform IPC message (StoredMessageEvent) to UI view model (Message).
 *
 * IPC returns storage format (event sourcing, optional fields).
 * UI expects view model format (required fields, conversationId).
 */
function toMessage(stored: StoredMessageEvent, conversationId: string): Message {
  return {
    id: stored.id,
    conversationId,
    role: stored.role ?? 'user',
    status: 'complete',
    content: stored.content ?? '',
    reasoning: stored.reasoning,
    createdAt: stored.createdAt ?? new Date().toISOString(),
    updatedAt: stored.updatedAt ?? new Date().toISOString(),
    parentId: stored.parentId ?? null,
    attachments: stored.attachments?.map((a) => ({
      type: a.type,
      path: a.path,
      mimeType: a.mimeType,
      url: `arc://attachment/${conversationId}/${a.path}`,
    })),
    model: stored.model,
    provider: stored.provider,
  }
}

// ============================================================================
// RESULT TYPES (UI-compatible)
// ============================================================================

export interface ListMessagesResult {
  messages: Message[]
  branchPoints: BranchInfo[]
}

export interface CreateBranchResult {
  message: Message
  branchPoints: BranchInfo[]
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getMessages(conversationId: string): Promise<ListMessagesResult> {
  const result = await window.arc.messages.list({ threadId: conversationId })
  return {
    messages: result.messages.map((m) => toMessage(m, conversationId)),
    branchPoints: result.branchPoints,
  }
}

export async function createMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  parentId: string | null,
  model: string,
  provider: string,
  attachments?: AttachmentInput[],
  reasoning?: string,
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number },
): Promise<Message> {
  const stored = await window.arc.messages.create({
    threadId: conversationId,
    input: {
      role,
      content,
      parentId,
      attachments,
      model,
      provider,
      reasoning,
      usage,
    },
  })
  return toMessage(stored, conversationId)
}

export async function createBranch(
  conversationId: string,
  parentId: string | null,
  content: string,
  model: string,
  provider: string,
  attachments?: AttachmentInput[],
): Promise<CreateBranchResult> {
  const result = await window.arc.messages.createBranch({
    threadId: conversationId,
    input: {
      parentId,
      content,
      attachments,
      model,
      provider,
    },
  })
  return {
    message: toMessage(result.message, conversationId),
    branchPoints: result.branchPoints,
  }
}

export async function updateMessage(
  conversationId: string,
  messageId: string,
  content: string,
  model: string,
  provider: string,
  attachments?: AttachmentInput[],
  reasoning?: string,
): Promise<Message> {
  const stored = await window.arc.messages.update({
    threadId: conversationId,
    messageId,
    input: {
      content,
      model,
      provider,
      attachments,
      reasoning,
    },
  })
  return toMessage(stored, conversationId)
}

// ============================================================================
// AI ORCHESTRATION
// ============================================================================

export interface StreamContext {
  provider: { baseURL?: string; apiKey?: string }
  modelId: string
  systemPrompt: string | null
  messages: AIMessage[]
  parentId: string | null
  threadId: string
  providerId: string
}

/**
 * Gather all data needed for an AI stream.
 * Parallel IPC calls to domain endpoints.
 */
export async function prepareStreamContext(
  prompt: Prompt,
  threadId: string,
  providerId: string,
  modelId: string,
  leafMessageId: string | null,
): Promise<StreamContext> {
  // Parallel calls to endpoints
  const [messagesResult, streamConfig, systemPrompt] = await Promise.all([
    leafMessageId
      ? window.arc.messages.getConversation({ threadId, leafMessageId })
      : window.arc.messages.list({ threadId }).then((r) => convertToAIMessages(r.messages, threadId)),
    window.arc.profiles.getStreamConfig({ providerId, modelId }),
    window.arc.personas.resolve({ prompt }),
  ])

  // Derive parentId: use provided leafMessageId, or last message from fetched list
  const parentId = leafMessageId ?? (messagesResult.length > 0 ? await getLastMessageId(threadId) : null)

  return {
    provider: { baseURL: streamConfig.baseURL ?? undefined, apiKey: streamConfig.apiKey ?? undefined },
    modelId: streamConfig.modelId,
    systemPrompt,
    messages: messagesResult,
    parentId,
    threadId,
    providerId: streamConfig.providerId,
  }
}

async function getLastMessageId(threadId: string): Promise<string | null> {
  const { messages } = await window.arc.messages.list({ threadId })
  return messages.at(-1)?.id ?? null
}

async function convertToAIMessages(
  messages: StoredMessageEvent[],
  threadId: string,
): Promise<AIMessage[]> {
  return Promise.all(
    messages.map(async (message): Promise<AIMessage> => {
      if (message.role === 'user' && message.attachments?.length) {
        const imageResults = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await window.arc.messages.readAttachment({ threadId, filename: att.path })
            if (!buffer) return null
            const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer)
            const base64 = btoa(String.fromCharCode(...bytes))
            return {
              type: 'image' as const,
              image: `data:${att.mimeType};base64,${base64}`,
              mediaType: att.mimeType,
            }
          }),
        )
        const imageParts = imageResults.filter((p) => p !== null)
        return {
          role: 'user',
          content: [...imageParts, { type: 'text' as const, text: message.content! }],
        }
      }

      return {
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content!,
      }
    }),
  )
}

/**
 * Start an AI chat stream with pre-gathered context.
 */
export async function startAIStream(ctx: StreamContext): Promise<{ streamId: string }> {
  return window.arc.ai.stream({
    provider: ctx.provider,
    modelId: ctx.modelId,
    systemPrompt: ctx.systemPrompt,
    messages: ctx.messages,
  })
}

export async function stopAIChat(streamId: string): Promise<void> {
  return window.arc.ai.stop({ streamId })
}

export async function startRefine(
  prompt: string,
  modelId: string,
  provider: { baseURL?: string; apiKey?: string },
): Promise<{ streamId: string }> {
  return window.arc.ai.refine({ provider, modelId, prompt })
}

/**
 * Transform stored message to UI message.
 *
 * Exported for use by stream-manager when handling completion.
 * The threadId must be tracked separately since events don't include it.
 */
export function transformMessage(stored: StoredMessageEvent, conversationId: string): Message {
  return toMessage(stored, conversationId)
}

// ============================================================================
// AI EVENT SUBSCRIPTIONS
// ============================================================================

export interface AICompleteData {
  streamId: string
  content: string
  reasoning: string
  usage: Usage
}

export function onAIDelta(callback: (data: { streamId: string; chunk: string }) => void): () => void {
  return window.arc.ai.onDelta(callback)
}

export function onAIReasoning(callback: (data: { streamId: string; chunk: string }) => void): () => void {
  return window.arc.ai.onReasoning(callback)
}

export function onAIComplete(callback: (data: AICompleteData) => void): () => void {
  return window.arc.ai.onComplete(callback)
}

export function onAIError(callback: (data: { streamId: string; error: string }) => void): () => void {
  return window.arc.ai.onError(callback)
}
