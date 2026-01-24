import type { Unsubscribe, AIUsage } from '@contracts/events'
import type {
  AttachmentInput,
  BranchInfo,
  StoredMessageEvent,
  MessageRole,
} from '@main/modules/messages/business'
import type { ThreadConfig } from '@main/modules/threads/json-file'
import type { ModelMessage } from '@ai-sdk/provider-utils'

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
  modelId?: string
  providerId?: string
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
    modelId: stored.modelId,
    providerId: stored.providerId,
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
  modelId: string,
  providerId: string,
  attachments?: AttachmentInput[],
  threadConfig?: ThreadConfig,
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
      modelId,
      providerId,
      threadConfig,
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
  modelId: string,
  providerId: string,
  attachments?: AttachmentInput[],
  threadConfig?: ThreadConfig,
): Promise<CreateBranchResult> {
  const result = await window.arc.messages.createBranch({
    threadId: conversationId,
    input: {
      parentId,
      content,
      attachments,
      modelId,
      providerId,
      threadConfig,
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
  modelId: string,
  providerId: string,
  attachments?: AttachmentInput[],
  reasoning?: string,
): Promise<Message> {
  const stored = await window.arc.messages.update({
    threadId: conversationId,
    messageId,
    input: {
      content,
      modelId,
      providerId,
      attachments,
      reasoning,
    },
  })
  return toMessage(stored, conversationId)
}

// ============================================================================
// AI ORCHESTRATION
// ============================================================================

/**
 * Convert stored messages to AI SDK format.
 * Loads attachments via IPC and encodes as base64 data URLs.
 */
async function convertToModelMessages(
  messages: StoredMessageEvent[],
  threadId: string,
): Promise<ModelMessage[]> {
  return Promise.all(
    messages.map(async (message): Promise<ModelMessage> => {
      if (message.role === 'user' && message.attachments?.length) {
        const imageResults = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await window.arc.messages.readAttachment({ threadId, filename: att.path })
            if (!buffer) return null
            // IPC transfers Buffer as Uint8Array; convert to base64
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

export interface StreamContext {
  provider: { baseURL?: string; apiKey?: string }
  modelId: string
  systemPrompt: string | null
  messages: ModelMessage[]
  parentId: string | null
  threadId: string
  providerId: string
}

/**
 * Gather all data needed for an AI stream.
 * Orchestration logic — calls messages, profiles, and personas modules.
 */
export async function prepareStreamContext(
  threadId: string,
  modelId: string,
): Promise<StreamContext> {
  const [{ messages: storedMessages }, modelsList] = await Promise.all([
    window.arc.messages.list({ threadId }),
    window.arc.profiles.listModels(),
  ])

  const model = modelsList.find((m) => m.id === modelId)
  if (!model) throw new Error(`Model ${modelId} not found`)

  const providerId = model.provider.id
  const providerConfig = await window.arc.profiles.getProviderConfig({ providerId })

  // Resolve system prompt from thread's promptSource
  const threads = await window.arc.threads.list()
  const thread = threads.find((t) => t.id === threadId)
  const systemPrompt = thread?.promptSource
    ? await resolvePromptSourceForStream(thread.promptSource)
    : null

  const messages = await convertToModelMessages(storedMessages, threadId)
  const parentId = storedMessages.at(-1)?.id ?? null

  return {
    provider: { baseURL: providerConfig.baseUrl ?? undefined, apiKey: providerConfig.apiKey ?? undefined },
    modelId,
    systemPrompt,
    messages,
    parentId,
    threadId,
    providerId,
  }
}

/**
 * Resolve a PromptSource to its content for streaming.
 */
async function resolvePromptSourceForStream(
  promptSource: { type: 'none' } | { type: 'direct'; content: string } | { type: 'persona'; personaId: string },
): Promise<string | null> {
  switch (promptSource.type) {
    case 'none':
      return null
    case 'direct':
      return promptSource.content
    case 'persona': {
      const personas = await window.arc.personas.list()
      const persona = personas.find((p: { name: string }) => p.name === promptSource.personaId)
      return persona?.systemPrompt ?? null
    }
  }
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
  usage: AIUsage
}

export function onAIDelta(callback: (data: { streamId: string; chunk: string }) => void): Unsubscribe {
  return window.arc.ai.onDelta(callback)
}

export function onAIReasoning(callback: (data: { streamId: string; chunk: string }) => void): Unsubscribe {
  return window.arc.ai.onReasoning(callback)
}

export function onAIComplete(callback: (data: AICompleteData) => void): Unsubscribe {
  return window.arc.ai.onComplete(callback)
}

export function onAIError(callback: (data: { streamId: string; error: string }) => void): Unsubscribe {
  return window.arc.ai.onError(callback)
}
