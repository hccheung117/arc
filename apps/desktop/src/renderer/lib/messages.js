// ============================================================================
// TRANSFORMATION
// ============================================================================

/**
 * Transform IPC message (StoredMessageEvent) to UI view model (Message).
 *
 * IPC returns storage format (event sourcing, optional fields).
 * UI expects view model format (required fields, conversationId).
 */
function toMessage(stored, conversationId) {
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
// API FUNCTIONS
// ============================================================================

export async function getMessages(conversationId) {
  const result = await window.arc.messages.list({ threadId: conversationId })
  return {
    messages: result.messages.map((m) => toMessage(m, conversationId)),
    branchPoints: result.branchPoints,
  }
}

export async function createMessage(
  conversationId,
  role,
  content,
  parentId,
  model,
  provider,
  attachments,
  reasoning,
  usage,
) {
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
  conversationId,
  parentId,
  content,
  model,
  provider,
  attachments,
) {
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
  conversationId,
  messageId,
  content,
  model,
  provider,
  attachments,
  reasoning,
) {
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

/**
 * Gather all data needed for an AI stream.
 * Parallel IPC calls to domain endpoints.
 */
export async function prepareStreamContext(
  prompt,
  threadId,
  providerId,
  modelId,
  leafMessageId,
) {
  // Parallel calls to endpoints
  const [messagesResult, streamConfig, systemPrompt] = await Promise.all([
    leafMessageId
      ? window.arc.messages.getConversation({ threadId, leafMessageId })
      : window.arc.messages.list({ threadId }).then((r) => convertToAIMessages(r.messages, threadId)),
    window.arc.settings.getActiveProfileId().then(profileId => {
      if (!profileId) throw new Error('No active profile')
      return window.arc.profiles.getStreamConfig({ profileId, providerId, modelId })
    }),
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
 * Start an AI chat stream with pre-gathered context.
 */
export async function startAIStream(ctx) {
  return window.arc.ai.stream({
    provider: ctx.provider,
    modelId: ctx.modelId,
    systemPrompt: ctx.systemPrompt,
    messages: ctx.messages,
  })
}

export async function stopAIChat(streamId) {
  return window.arc.ai.stop({ streamId })
}

export async function startRefine(
  prompt,
  modelId,
  provider,
) {
  return window.arc.ai.refine({ provider, modelId, prompt })
}

/**
 * Transform stored message to UI message.
 *
 * Exported for use by stream-manager when handling completion.
 * The threadId must be tracked separately since events don't include it.
 */
export function transformMessage(stored, conversationId) {
  return toMessage(stored, conversationId)
}

// ============================================================================
// AI EVENT SUBSCRIPTIONS
// ============================================================================

export function onAIDelta(callback) {
  return window.arc.ai.onDelta(callback)
}

export function onAIReasoning(callback) {
  return window.arc.ai.onReasoning(callback)
}

export function onAIComplete(callback) {
  return window.arc.ai.onComplete(callback)
}

export function onAIError(callback) {
  return window.arc.ai.onError(callback)
}
