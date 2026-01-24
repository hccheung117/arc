/**
 * IPC Preload Module
 *
 * Exposes window.arc API via contextBridge.
 * Messages and threads use module-based channels (arc:{module}:{op}).
 * Other domains use contract-generated clients.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { createClient } from '@main/kernel/ipc'
import { personasContract } from '@contracts/personas'
import { profilesContract } from '@contracts/profiles'
import { settingsContract } from '@contracts/settings'
import { modelsContract } from '@contracts/models'
import { aiContract } from '@contracts/ai'
import { uiContract } from '@contracts/ui'
import { utilsContract } from '@contracts/utils'
import { filesContract } from '@contracts/files'
import type { StoredMessageEvent, StoredThread, BranchInfo } from '@main/modules/messages/business'
import type { PersonasEvent, ProfilesEvent, AIStreamEvent, Unsubscribe } from '@contracts/events'

// ============================================================================
// CONTRACT-GENERATED CLIENTS
// ============================================================================

const personas = createClient(ipcRenderer, personasContract)
const profiles = createClient(ipcRenderer, profilesContract)
const settings = createClient(ipcRenderer, settingsContract)
const models = createClient(ipcRenderer, modelsContract)
const ai = createClient(ipcRenderer, aiContract)
const ui = createClient(ipcRenderer, uiContract)
const utils = createClient(ipcRenderer, utilsContract)
const files = createClient(ipcRenderer, filesContract)

// ============================================================================
// MODULE-BASED CLIENTS (messages + threads)
// ============================================================================

type CreateMessageInput = {
  role: 'user' | 'assistant' | 'system'
  content: string
  parentId: string | null
  attachments?: { type: 'image'; data: string; mimeType: string; name?: string }[]
  modelId: string
  providerId: string
  threadConfig?: { promptSource: { type: 'none' } | { type: 'direct'; content: string } | { type: 'persona'; personaId: string } }
}

type CreateBranchInput = {
  parentId: string | null
  content: string
  attachments?: { type: 'image'; data: string; mimeType: string; name?: string }[]
  modelId: string
  providerId: string
  threadConfig?: { promptSource: { type: 'none' } | { type: 'direct'; content: string } | { type: 'persona'; personaId: string } }
}

type UpdateMessageInput = {
  content: string
  modelId: string
  providerId: string
  attachments?: { type: 'image'; data: string; mimeType: string; name?: string }[]
  reasoning?: string
}

const messages = {
  list: (input: { threadId: string }): Promise<{ messages: StoredMessageEvent[]; branchPoints: BranchInfo[] }> =>
    ipcRenderer.invoke('arc:messages:list', input),

  create: (input: { threadId: string; input: CreateMessageInput }): Promise<StoredMessageEvent> =>
    ipcRenderer.invoke('arc:messages:create', input),

  createBranch: (input: { threadId: string; input: CreateBranchInput }): Promise<{ message: StoredMessageEvent; branchPoints: BranchInfo[] }> =>
    ipcRenderer.invoke('arc:messages:createBranch', input),

  update: (input: { threadId: string; messageId: string; input: UpdateMessageInput }): Promise<StoredMessageEvent> =>
    ipcRenderer.invoke('arc:messages:update', input),
}

type ThreadPatch = {
  title?: string
  pinned?: boolean
  promptSource?: { type: 'none' } | { type: 'direct'; content: string } | { type: 'persona'; personaId: string }
}

type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

const threads = {
  list: (): Promise<StoredThread[]> =>
    ipcRenderer.invoke('arc:threads:list'),

  update: (input: { threadId: string; patch: ThreadPatch }): Promise<StoredThread> =>
    ipcRenderer.invoke('arc:threads:update', input),

  delete: (input: { threadId: string }): Promise<void> =>
    ipcRenderer.invoke('arc:threads:delete', input),

  duplicate: (input: { threadId: string; upToMessageId?: string }): Promise<StoredThread> =>
    ipcRenderer.invoke('arc:threads:duplicate', input),

  createFolder: (input: { name: string; threadId1: string; threadId2: string }): Promise<StoredThread> =>
    ipcRenderer.invoke('arc:threads:createFolder', input),

  createFolderWithThread: (input: { threadId: string }): Promise<StoredThread> =>
    ipcRenderer.invoke('arc:threads:createFolderWithThread', input),

  moveToFolder: (input: { threadId: string; folderId: string }): Promise<void> =>
    ipcRenderer.invoke('arc:threads:moveToFolder', input),

  moveToRoot: (input: { threadId: string }): Promise<void> =>
    ipcRenderer.invoke('arc:threads:moveToRoot', input),

  reorderInFolder: (input: { folderId: string; orderedChildIds: string[] }): Promise<void> =>
    ipcRenderer.invoke('arc:threads:reorderInFolder', input),

  onEvent: (callback: (event: ThreadEvent) => void): Unsubscribe => {
    const onCreated = (_: Electron.IpcRendererEvent, data: StoredThread) =>
      callback({ type: 'created', thread: data })
    const onUpdated = (_: Electron.IpcRendererEvent, data: StoredThread) =>
      callback({ type: 'updated', thread: data })
    const onDeleted = (_: Electron.IpcRendererEvent, data: string) =>
      callback({ type: 'deleted', id: data })
    const onThreadCreated = (_: Electron.IpcRendererEvent, data: StoredThread) =>
      callback({ type: 'created', thread: data })

    ipcRenderer.on('arc:threads:created', onCreated)
    ipcRenderer.on('arc:threads:updated', onUpdated)
    ipcRenderer.on('arc:threads:deleted', onDeleted)
    ipcRenderer.on('arc:messages:threadCreated', onThreadCreated)

    return () => {
      ipcRenderer.removeListener('arc:threads:created', onCreated)
      ipcRenderer.removeListener('arc:threads:updated', onUpdated)
      ipcRenderer.removeListener('arc:threads:deleted', onDeleted)
      ipcRenderer.removeListener('arc:messages:threadCreated', onThreadCreated)
    }
  },
}

// ============================================================================
// EVENT SUBSCRIPTIONS
// ============================================================================

const createEventSubscription = <T>(channel: string) => {
  return (callback: (event: T) => void): Unsubscribe => {
    const listener = (_event: Electron.IpcRendererEvent, data: T) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

// ============================================================================
// ARC API
// ============================================================================

export interface ArcAPI {
  threads: typeof threads
  messages: typeof messages
  models: typeof models
  ai: typeof ai & {
    onEvent(callback: (event: AIStreamEvent) => void): Unsubscribe
  }
  settings: typeof settings
  ui: typeof ui
  personas: typeof personas & {
    onEvent(callback: (event: PersonasEvent) => void): Unsubscribe
  }
  profiles: typeof profiles & {
    onEvent(callback: (event: ProfilesEvent) => void): Unsubscribe
  }
  utils: typeof utils & {
    getFilePath(file: File): string
  }
  log: {
    error(tag: string, message: string, stack?: string): void
  }
  files: typeof files
}

const arcAPI: ArcAPI = {
  threads,

  messages,

  models,

  ai: {
    ...ai,
    onEvent: createEventSubscription<AIStreamEvent>('arc:ai:event'),
  },

  settings,

  ui,

  personas: {
    ...personas,
    onEvent: createEventSubscription<PersonasEvent>('arc:personas:event'),
  },

  profiles: {
    ...profiles,
    onEvent: createEventSubscription<ProfilesEvent>('arc:profiles:event'),
  },

  utils: {
    ...utils,
    getFilePath: (file: File) => webUtils.getPathForFile(file),
  },

  log: {
    error: (tag: string, message: string, stack?: string) =>
      ipcRenderer.send('arc:log:error', tag, message, stack),
  },

  files,
}

contextBridge.exposeInMainWorld('arc', arcAPI)

// ============================================================================
// GLOBAL TYPE DECLARATION
// ============================================================================

declare global {
  interface Window {
    arc: ArcAPI
  }
}
