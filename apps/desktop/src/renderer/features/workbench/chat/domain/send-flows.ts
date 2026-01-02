import type { SendNewContext, EditContext, SendResult } from './types'
import { createMessage, createBranch, updateMessage, getMessages, startAIChat } from '@renderer/lib/messages'
import { findChildren } from './message-tree'

/**
 * Send a new message in the conversation
 *
 * Flow:
 * 1. Create user message with parentId pointing to last message
 * 2. Start AI chat to generate response
 */
export async function sendNewMessage(ctx: SendNewContext): Promise<SendResult> {
  const userMessage = await createMessage(
    ctx.threadId,
    'user',
    ctx.content,
    ctx.parentId,
    ctx.model.id,
    ctx.model.provider.id,
    ctx.attachments,
  )

  const { streamId } = await startAIChat(ctx.threadId, ctx.model.id)

  const { messages } = await getMessages(ctx.threadId)

  return {
    userMessage,
    streamId,
    messages,
  }
}

/**
 * Edit a user message by creating a new branch
 *
 * Flow:
 * 1. Create branch at the parent of the edited message
 * 2. Auto-select the new branch
 * 3. Start AI chat to generate response
 */
export async function editUserMessage(ctx: EditContext): Promise<SendResult> {
  await createBranch(
    ctx.threadId,
    ctx.parentId,
    ctx.content,
    ctx.model.id,
    ctx.model.provider.id,
    ctx.attachments,
  )

  const { messages } = await getMessages(ctx.threadId)

  // Calculate new branch selection
  const childrenAtParent = findChildren(messages, ctx.parentId)
  const newBranchIndex = childrenAtParent.length - 1

  const { streamId } = await startAIChat(ctx.threadId, ctx.model.id)

  return {
    streamId,
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
export async function editAssistantMessage(ctx: EditContext): Promise<SendResult> {
  if (!ctx.originalMessage?.modelId || !ctx.originalMessage?.providerId) {
    throw new Error('Cannot edit message: missing model info')
  }

  await updateMessage(
    ctx.threadId,
    ctx.messageId,
    ctx.content,
    ctx.originalMessage.modelId,
    ctx.originalMessage.providerId,
  )

  const { messages } = await getMessages(ctx.threadId)

  return { messages }
}
