/**
 * IPC Preload Module
 *
 * Exposes window.arc API via contextBridge.
 * All domains use direct ipcRenderer.invoke calls with arc:{module}:{op} channels.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { StoredMessageEvent, BranchInfo } from '@main/modules/messages/business'
import type { StoredThread, PromptSource } from '@main/modules/threads/json-file'
import type { Persona } from '@main/modules/personas/business'
import type { ProfileInstallResult, ProfileInfo, ProviderConfig, Model } from '@main/modules/profiles/business'
import type { ArcFile } from '@main/modules/profiles/json-file'
import type { StreamInput, RefineInput, FetchModelsInput, Usage } from '@main/modules/ai/business'
import type { ThreadContextMenuParams, ThreadMenuAction, MessageMenuAction } from '@main/modules/ui/business'

// ============================================================================
// DIRECT IPC CLIENTS
// ============================================================================

const settings = {
  getFavorites: (): Promise<Array<{ provider: string; model: string }>> =>
    ipcRenderer.invoke('arc:settings:getFavorites'),
  setFavorites: (input: { favorites: Array<{ provider: string; model: string }> }): Promise<void> =>
    ipcRenderer.invoke('arc:settings:setFavorites', input),
}

const ui = {
  showThreadContextMenu: (input: ThreadContextMenuParams): Promise<ThreadMenuAction | null> =>
    ipcRenderer.invoke('arc:ui:showThreadContextMenu', input),
  showMessageContextMenu: (input: { hasEditOption: boolean }): Promise<MessageMenuAction | null> =>
    ipcRenderer.invoke('arc:ui:showMessageContextMenu', input),
}

const utils = {
  openFile: (input: { filePath: string }): Promise<void> =>
    ipcRenderer.invoke('arc:ui:openFile', input),
}

const ai = {
  stream: (input: StreamInput): Promise<{ streamId: string }> =>
    ipcRenderer.invoke('arc:ai:stream', input),

  stop: (input: { streamId: string }): Promise<void> =>
    ipcRenderer.invoke('arc:ai:stop', input),

  refine: (input: RefineInput): Promise<{ streamId: string }> =>
    ipcRenderer.invoke('arc:ai:refine', input),

  fetchModels: (input: FetchModelsInput): Promise<Array<{ id: string }>> =>
    ipcRenderer.invoke('arc:ai:fetchModels', input),
}

interface ActiveProfileDetails {
  id: string
  name: string
  modelAssignments?: Record<string, { provider: string; model: string }>
}

const profiles = {
  install: (input: { filePath: string }): Promise<ProfileInstallResult> =>
    ipcRenderer.invoke('arc:profiles:install', input),

  uninstall: (input: { profileId: string }): Promise<void> =>
    ipcRenderer.invoke('arc:profiles:uninstall', input),

  activate: (input: { profileId: string | null }): Promise<void> =>
    ipcRenderer.invoke('arc:profiles:activate', input),

  list: (): Promise<ProfileInfo[]> =>
    ipcRenderer.invoke('arc:profiles:list'),

  getActiveId: (): Promise<string | null> =>
    ipcRenderer.invoke('arc:profiles:getActiveId'),

  getActive: (): Promise<ArcFile | null> =>
    ipcRenderer.invoke('arc:profiles:getActive'),

  getActiveDetails: (): Promise<ActiveProfileDetails | null> =>
    ipcRenderer.invoke('arc:profiles:getActiveDetails'),

  getProviderConfig: (input: { providerId: string }): Promise<ProviderConfig> =>
    ipcRenderer.invoke('arc:profiles:getProviderConfig', input),

  listModels: (): Promise<Model[]> =>
    ipcRenderer.invoke('arc:profiles:listModels'),

  lookupModelProvider: (input: { modelId: string }): Promise<string> =>
    ipcRenderer.invoke('arc:profiles:lookupModelProvider', input),
}

const personas = {
  list: (): Promise<Persona[]> =>
    ipcRenderer.invoke('arc:personas:list'),

  get: (input: { name: string }): Promise<Persona | null> =>
    ipcRenderer.invoke('arc:personas:get', input),

  create: (input: { name: string; systemPrompt: string }): Promise<Persona> =>
    ipcRenderer.invoke('arc:personas:create', input),

  update: (input: { name: string; systemPrompt: string }): Promise<Persona> =>
    ipcRenderer.invoke('arc:personas:update', input),

  delete: (input: { name: string }): Promise<void> =>
    ipcRenderer.invoke('arc:personas:delete', input),

  resolve: (input: { promptSource: PromptSource }): Promise<string | null> =>
    ipcRenderer.invoke('arc:personas:resolve', input),
}


type CreateMessageInput = {
  role: 'user' | 'assistant' | 'system'
  content: string
  parentId: string | null
  attachments?: { type: 'image'; data: string; mimeType: string; name?: string }[]
  model: string
  provider: string
  threadConfig?: { promptSource: { type: 'none' } | { type: 'direct'; content: string } | { type: 'persona'; personaId: string } }
  reasoning?: string
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number }
}

type CreateBranchInput = {
  parentId: string | null
  content: string
  attachments?: { type: 'image'; data: string; mimeType: string; name?: string }[]
  model: string
  provider: string
  threadConfig?: { promptSource: { type: 'none' } | { type: 'direct'; content: string } | { type: 'persona'; personaId: string } }
}

type UpdateMessageInput = {
  content: string
  model: string
  provider: string
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

  readAttachment: (input: { threadId: string; filename: string }): Promise<Buffer | null> =>
    ipcRenderer.invoke('arc:messages:readAttachment', input),

  export: (input: { threadId: string }): Promise<string | null> =>
    ipcRenderer.invoke('arc:messages:export', input),

  getAttachmentPath: (input: { threadId: string; filename: string }): Promise<string> =>
    ipcRenderer.invoke('arc:messages:getAttachmentPath', input),
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

  onEvent: (callback: (event: ThreadEvent) => void): () => void => {
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
  return (callback: (event: T) => void): () => void => {
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
  ai: typeof ai & {
    onDelta(callback: (data: { streamId: string; chunk: string }) => void): () => void
    onReasoning(callback: (data: { streamId: string; chunk: string }) => void): () => void
    onComplete(callback: (data: { streamId: string; content: string; reasoning: string; usage: Usage }) => void): () => void
    onError(callback: (data: { streamId: string; error: string }) => void): () => void
  }
  settings: typeof settings
  ui: typeof ui
  personas: typeof personas & {
    onCreated(callback: (data: Persona) => void): () => void
    onUpdated(callback: (data: Persona) => void): () => void
    onDeleted(callback: (data: string) => void): () => void
  }
  profiles: typeof profiles & {
    onInstalled(callback: (data: ProfileInstallResult) => void): () => void
    onUninstalled(callback: (data: string) => void): () => void
    onActivated(callback: (data: string | null) => void): () => void
  }
  utils: typeof utils & {
    getFilePath(file: File): string
  }
  log: {
    error(tag: string, message: string, stack?: string): void
  }
}

const arcAPI: ArcAPI = {
  threads,

  messages,

  ai: {
    ...ai,
    onDelta: createEventSubscription<{ streamId: string; chunk: string }>('arc:ai:delta'),
    onReasoning: createEventSubscription<{ streamId: string; chunk: string }>('arc:ai:reasoning'),
    onComplete: createEventSubscription<{ streamId: string; content: string; reasoning: string; usage: Usage }>('arc:ai:complete'),
    onError: createEventSubscription<{ streamId: string; error: string }>('arc:ai:error'),
  },

  settings,

  ui,

  personas: {
    ...personas,
    onCreated: createEventSubscription<Persona>('arc:personas:created'),
    onUpdated: createEventSubscription<Persona>('arc:personas:updated'),
    onDeleted: createEventSubscription<string>('arc:personas:deleted'),
  },

  profiles: {
    ...profiles,
    onInstalled: createEventSubscription<ProfileInstallResult>('arc:profiles:installed'),
    onUninstalled: createEventSubscription<string>('arc:profiles:uninstalled'),
    onActivated: createEventSubscription<string | null>('arc:profiles:activated'),
  },

  utils: {
    ...utils,
    getFilePath: (file: File) => webUtils.getPathForFile(file),
  },

  log: {
    error: (tag: string, message: string, stack?: string) =>
      ipcRenderer.send('arc:log:error', tag, message, stack),
  },

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
