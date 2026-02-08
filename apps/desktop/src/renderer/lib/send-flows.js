import { createMessage, createBranch, updateMessage, getMessages } from '@renderer/lib/messages'
import { findChildren } from './message-tree'

function deriveTitle(content) {
  const firstLine = content.split('\n')[0].trim()
  return firstLine.slice(0, 50)
}

/**
 * Persist a new user message
 *
 * Streaming is UI-owned—caller starts the AI stream after this returns.
 */
export async function sendNewMessage(ctx) {
  // Thread emerges on first message
  if (ctx.threadConfig) {
    const title = deriveTitle(ctx.content)
    await window.arc.threads.create({ threadId: ctx.threadId, config: { ...ctx.threadConfig, title } })
  }

  const userMessage = await createMessage(
    ctx.threadId,
    'user',
    ctx.content,
    ctx.parentId,
    ctx.model.id,
    ctx.model.provider.id,
    ctx.attachments,
  )

  const { messages } = await getMessages(ctx.threadId)

  return { userMessage, messages }
}

/**
 * Create a new branch from an edited user message
 *
 * Streaming is UI-owned—caller starts the AI stream after this returns.
 */
export async function editUserMessage(ctx) {
  // Thread emerges on first message
  if (ctx.threadConfig) {
    const title = deriveTitle(ctx.content)
    await window.arc.threads.create({ threadId: ctx.threadId, config: { ...ctx.threadConfig, title } })
  }

  await createBranch(
    ctx.threadId,
    ctx.parentId,
    ctx.content,
    ctx.model.id,
    ctx.model.provider.id,
    ctx.attachments,
  )

  const { messages } = await getMessages(ctx.threadId)

  const childrenAtParent = findChildren(messages, ctx.parentId)
  const newBranchIndex = childrenAtParent.length - 1

  return {
    messages,
    newBranchSelection: {
      parentId: ctx.parentId,
      index: newBranchIndex,
    },
  }
}

/**
 * Edit an assistant message in place
 *
 * Flow:
 * 1. Update the message content directly
 * 2. No new branch, no AI response needed
 */
export async function editAssistantMessage(ctx) {
  if (!ctx.originalMessage?.model || !ctx.originalMessage?.provider) {
    throw new Error('Cannot edit message: missing model info')
  }

  await updateMessage(
    ctx.threadId,
    ctx.messageId,
    ctx.content,
    ctx.originalMessage.model,
    ctx.originalMessage.provider,
  )

  const { messages } = await getMessages(ctx.threadId)

  return { messages }
}
