/**
 * Data IPC Handlers
 *
 * Orchestration layer for messages and profiles.
 * Thread/folder handlers are in app/threads.ts.
 */

import type { IpcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type { BranchInfo } from '@arc-types/arc-api'
import type { StoredThread, StoredMessageEvent } from '@main/lib/messages/schemas'
import { appendMessage, readMessages } from '@main/lib/messages/operations'
import { threadIndexFile } from '@main/lib/messages/storage'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  getActiveProfile,
  generateProviderId,
  type ProfileInstallResult,
} from '@main/lib/profile/operations'
import { syncModels } from '@main/lib/profile/models'
import { info, error } from '@main/foundation/logger'
import { validated, broadcast, register } from '@main/foundation/ipc'

// ============================================================================
// SCHEMAS
// ============================================================================

const AttachmentInputSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string(),
  name: z.string().optional(),
})

const ThreadConfigSchema = z.object({
  systemPrompt: z.string().nullable(),
})

const CreateMessageInputSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  parentId: z.string().nullable(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
  threadConfig: ThreadConfigSchema.optional(),
})

const CreateBranchInputSchema = z.object({
  parentId: z.string().nullable(),
  content: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
  threadConfig: ThreadConfigSchema.optional(),
})

const UpdateMessageInputSchema = z.object({
  content: z.string(),
  modelId: z.string(),
  providerId: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  reasoning: z.string().optional(),
})

// ============================================================================
// THREAD EVENTS (for message creation side effect)
// ============================================================================

type ThreadEvent = { type: 'created'; thread: StoredThread }

function emitThread(event: ThreadEvent): void {
  broadcast('arc:threads:event', event)
}

// ============================================================================
// MESSAGES
// ============================================================================

const messageHandlers = {
  'arc:messages:list': validated(
    [z.string()],
    async (threadId): Promise<{ messages: StoredMessageEvent[]; branchPoints: BranchInfo[] }> =>
      readMessages(threadId),
  ),

  'arc:messages:create': validated(
    [z.string(), CreateMessageInputSchema],
    async (threadId, input): Promise<StoredMessageEvent> => {
      const { message, threadCreated } = await appendMessage({
        type: 'new',
        threadId,
        ...input,
      })

      if (threadCreated) {
        const index = await threadIndexFile().read()
        const thread = index.threads.find((t) => t.id === threadId)
        if (thread) emitThread({ type: 'created', thread })
      }

      return message
    },
  ),

  'arc:messages:createBranch': validated(
    [z.string(), CreateBranchInputSchema],
    async (
      threadId,
      input,
    ): Promise<{ message: StoredMessageEvent; branchPoints: BranchInfo[] }> => {
      const { message } = await appendMessage({
        type: 'new',
        threadId,
        role: 'user',
        content: input.content,
        parentId: input.parentId,
        attachments: input.attachments,
        modelId: input.modelId,
        providerId: input.providerId,
        threadConfig: input.threadConfig,
      })

      const { branchPoints } = await readMessages(threadId)
      return { message, branchPoints }
    },
  ),

  'arc:messages:update': validated(
    [z.string(), z.string(), UpdateMessageInputSchema],
    async (threadId, messageId, input): Promise<StoredMessageEvent> => {
      const { message } = await appendMessage({
        type: 'edit',
        threadId,
        messageId,
        ...input,
      })
      return message
    },
  ),
}

// ============================================================================
// PROFILES
// ============================================================================

type ProfileEvent =
  | { type: 'installed'; profile: ProfileInstallResult }
  | { type: 'uninstalled'; profileId: string }
  | { type: 'activated'; profileId: string | null }

const emitProfile = (event: ProfileEvent) => broadcast('arc:profiles:event', event)

/** Refreshes model cache after profile changes (background, errors logged) */
async function refreshModelsCache(): Promise<void> {
  try {
    const profile = await getActiveProfile()
    const providers =
      profile?.providers.map((p) => ({
        id: generateProviderId(p),
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        filter: p.modelFilter,
        aliases: p.modelAliases,
        providerName: profile.name,
      })) ?? []
    const updated = await syncModels(providers)
    if (updated) broadcast('arc:models:event', { type: 'updated' })
  } catch (err) {
    error('models', 'Background fetch failed', err as Error)
  }
}

const profileHandlers = {
  'arc:profiles:list': listProfiles,

  'arc:profiles:getActive': getActiveProfileId,

  'arc:profiles:install': validated([z.string()], async (filePath): Promise<ProfileInstallResult> => {
    info('profiles', `Install request: ${filePath}`)
    const content = await readFile(filePath, 'utf-8')

    const result = await installProfile(content)
    emitProfile({ type: 'installed', profile: result })

    await activateProfile(result.id)
    emitProfile({ type: 'activated', profileId: result.id })

    refreshModelsCache()
    return result
  }),

  'arc:profiles:uninstall': validated([z.string()], async (profileId) => {
    await uninstallProfile(profileId)
    emitProfile({ type: 'uninstalled', profileId })
    refreshModelsCache()
  }),

  'arc:profiles:activate': validated([z.string().nullable()], async (profileId) => {
    await activateProfile(profileId)
    emitProfile({ type: 'activated', profileId })
    refreshModelsCache()
  }),
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerDataHandlers(ipcMain: IpcMain): void {
  register(ipcMain, messageHandlers)
  register(ipcMain, profileHandlers)
}
