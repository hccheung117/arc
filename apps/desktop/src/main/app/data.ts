/**
 * Data IPC Handlers
 *
 * Orchestration layer for conversation, message, and profile operations.
 * Composes building blocks from lib/ modules.
 */

import type { IpcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type { StoredThread, StoredMessageEvent, BranchInfo } from '@main/lib/messages/schemas'
import { listThreads, emitThreadEvent, deleteThread, updateThread } from '@main/lib/messages/threads'
import { appendMessage, readMessages } from '@main/lib/messages/operations'
import { threadIndexFile } from '@main/lib/messages/storage'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  getActiveProfile,
  emitProfilesEvent,
  generateProviderId,
  type ProfileInfo,
  type ProfileInstallResult,
} from '@main/lib/profile/operations'
import { syncModels } from '@main/lib/models/sync'
import { OPENAI_BASE_URL } from '@main/lib/ai/types'
import { info, error } from '@main/foundation/logger'
import { validated, broadcast } from '@main/foundation/ipc'

// ============================================================================
// IPC SCHEMAS (app-level input validation)
// ============================================================================

const ThreadPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
})

const AttachmentInputSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string(),
  name: z.string().optional(),
})

const CreateMessageInputSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  parentId: z.string().nullable(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
})

const CreateBranchInputSchema = z.object({
  parentId: z.string().nullable(),
  content: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
})

const UpdateMessageInputSchema = z.object({
  content: z.string(),
  modelId: z.string(),
  providerId: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  reasoning: z.string().optional(),
})

// ============================================================================
// THREADS
// ============================================================================

async function handleThreadsList(): Promise<StoredThread[]> {
  return listThreads()
}

const handleThreadsUpdate = validated(
  [z.string(), ThreadPatchSchema],
  async (id, patch): Promise<StoredThread> => {
    return updateThread(id, patch)
  },
)

const handleThreadsDelete = validated([z.string()], async (id) => {
  await deleteThread(id)
})

function registerThreadsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:threads:list', handleThreadsList)
  ipcMain.handle('arc:threads:update', handleThreadsUpdate)
  ipcMain.handle('arc:threads:delete', handleThreadsDelete)
}

// ============================================================================
// MESSAGES
// ============================================================================

interface GetMessagesResult {
  messages: StoredMessageEvent[]
  branchPoints: BranchInfo[]
}

interface CreateBranchResult {
  message: StoredMessageEvent
  branchPoints: BranchInfo[]
}

const handleMessagesList = validated(
  [z.string()],
  async (threadId): Promise<GetMessagesResult> => {
    return readMessages(threadId)
  },
)

const handleMessagesCreate = validated(
  [z.string(), CreateMessageInputSchema],
  async (threadId, input): Promise<StoredMessageEvent> => {
    const { message, threadCreated } = await appendMessage({
      type: 'new',
      threadId,
      ...input,
    })

    if (threadCreated) {
      // Fetch the created thread for event emission
      const index = await threadIndexFile().read()
      const thread = index.threads.find((t) => t.id === threadId)
      if (thread) {
        emitThreadEvent({ type: 'created', thread })
      }
    }

    return message
  },
)

const handleMessagesCreateBranch = validated(
  [z.string(), CreateBranchInputSchema],
  async (threadId, input): Promise<CreateBranchResult> => {
    const { message } = await appendMessage({
      type: 'new',
      threadId,
      role: 'user',
      content: input.content,
      parentId: input.parentId,
      attachments: input.attachments,
      modelId: input.modelId,
      providerId: input.providerId,
    })

    const { branchPoints } = await readMessages(threadId)
    return { message, branchPoints }
  },
)

const handleMessagesUpdate = validated(
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
)

function registerMessagesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:messages:list', handleMessagesList)
  ipcMain.handle('arc:messages:create', handleMessagesCreate)
  ipcMain.handle('arc:messages:createBranch', handleMessagesCreateBranch)
  ipcMain.handle('arc:messages:update', handleMessagesUpdate)
}

// ============================================================================
// PROFILES
// ============================================================================

/**
 * Refreshes the model cache after profile changes.
 * Background operation - errors are logged but not thrown.
 */
async function refreshModelsCache(): Promise<void> {
  try {
    const profile = await getActiveProfile()
    const providers = profile?.providers.map((p) => ({
      id: generateProviderId(p),
      baseUrl: p.baseUrl ?? OPENAI_BASE_URL,
      apiKey: p.apiKey ?? null,
      filter: p.modelFilter ?? null,
      aliases: p.modelAliases ?? null,
      name: profile.name,
    })) ?? []
    const updated = await syncModels(providers)
    if (updated) broadcast('arc:models:event', { type: 'updated' })
  } catch (err) {
    error('models', 'Background fetch failed', err as Error)
  }
}

async function handleProfilesList(): Promise<ProfileInfo[]> {
  return listProfiles()
}

async function handleProfilesGetActive(): Promise<string | null> {
  return getActiveProfileId()
}

const handleProfilesInstall = validated([z.string()], async (filePath): Promise<ProfileInstallResult> => {
  info('profiles', `Install request: ${filePath}`)
  const content = await readFile(filePath, 'utf-8')

  const result = await installProfile(content)
  emitProfilesEvent({ type: 'installed', profile: result })

  await activateProfile(result.id)
  emitProfilesEvent({ type: 'activated', profileId: result.id })

  // Background model fetch after activation
  refreshModelsCache()

  return result
})

const handleProfilesUninstall = validated([z.string()], async (profileId) => {
  await uninstallProfile(profileId)
  emitProfilesEvent({ type: 'uninstalled', profileId })

  // Background model fetch after uninstall
  refreshModelsCache()
})

const handleProfilesActivate = validated([z.string().nullable()], async (profileId) => {
  await activateProfile(profileId)
  emitProfilesEvent({ type: 'activated', profileId })

  // Background model fetch after activation
  refreshModelsCache()
})

function registerProfilesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:profiles:list', handleProfilesList)
  ipcMain.handle('arc:profiles:getActive', handleProfilesGetActive)
  ipcMain.handle('arc:profiles:install', handleProfilesInstall)
  ipcMain.handle('arc:profiles:uninstall', handleProfilesUninstall)
  ipcMain.handle('arc:profiles:activate', handleProfilesActivate)
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

export function registerDataHandlers(ipcMain: IpcMain): void {
  registerThreadsHandlers(ipcMain)
  registerMessagesHandlers(ipcMain)
  registerProfilesHandlers(ipcMain)
}
