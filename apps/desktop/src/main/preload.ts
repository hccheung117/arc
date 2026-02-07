/**
 * IPC Preload Module
 *
 * Exposes window.arc API via contextBridge.
 * Module clients are auto-generated via createClient() with types derived from module definitions.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ModuleDefinition } from '@main/kernel/module'
import type { StoredThread } from '@main/modules/threads/json-file'
import type { Persona } from '@main/modules/personas/business'
import type { ProfileInstallResult } from '@main/modules/profiles/business'
import type { Usage } from '@main/modules/ai/business'

// Module definition imports (type-only for API extraction)
import type aiMod from '@main/modules/ai/mod'
import type messagesMod from '@main/modules/messages/mod'
import type personasMod from '@main/modules/personas/mod'
import type profilesMod from '@main/modules/profiles/mod'
import type settingsMod from '@main/modules/settings/mod'
import type threadsMod from '@main/modules/threads/mod'
import type uiMod from '@main/modules/ui/mod'

// ============================================================================
// MODULE API TYPES (derived from module definitions)
// ============================================================================

type ExtractAPI<T> = T extends ModuleDefinition<infer API> ? API : never

type ModuleAPIs = {
  ai: ExtractAPI<typeof aiMod>
  messages: ExtractAPI<typeof messagesMod>
  personas: ExtractAPI<typeof personasMod>
  profiles: ExtractAPI<typeof profilesMod>
  settings: ExtractAPI<typeof settingsMod>
  threads: ExtractAPI<typeof threadsMod>
  ui: ExtractAPI<typeof uiMod>
}

type ModuleName = keyof ModuleAPIs

// ============================================================================
// CLIENT FACTORY
// ============================================================================

/**
 * Creates a typed IPC client for a module.
 * All operations are forwarded to ipcRenderer.invoke with arc:{module}:{op} channels.
 *
 * Note: We must create concrete objects with function properties (not Proxies)
 * because contextBridge.exposeInMainWorld cannot serialize Proxy objects.
 */
function createClient<M extends ModuleName>(
  moduleName: M,
  operations: readonly string[]
): ModuleAPIs[M] {
  const client: Record<string, (input?: unknown) => Promise<unknown>> = {}
  for (const op of operations) {
    client[op] = (input?: unknown) =>
      ipcRenderer.invoke(`arc:${moduleName}:${op}`, input)
  }
  return client as ModuleAPIs[M]
}

// ============================================================================
// MODULE CLIENTS (explicit operation lists for contextBridge compatibility)
// ============================================================================

const ai = createClient('ai', ['stream', 'stop', 'refine', 'fetchModels'] as const)
const messages = createClient('messages', ['list', 'create', 'createBranch', 'update', 'duplicateData', 'deleteData', 'readAttachment', 'getAttachmentPath', 'export', 'getConversation'] as const)
const personas = createClient('personas', ['list', 'get', 'create', 'update', 'delete', 'resolve'] as const)
const profiles = createClient('profiles', ['install', 'uninstall', 'list', 'read', 'readSettings', 'syncModels', 'clearModelsCache', 'listModels', 'getProviderConfig', 'getStreamConfig'] as const)
const settings = createClient('settings', ['activate', 'getActiveProfileId', 'getFavorites', 'setFavorites', 'getAssignments', 'setAssignments', 'getShortcuts', 'setShortcuts'] as const)
const threads = createClient('threads', ['list', 'create', 'update', 'delete', 'duplicate', 'folderThreads', 'moveToFolder', 'moveToRoot', 'reorderInFolder'] as const)
const ui = createClient('ui', ['getMinSize', 'buildAppMenu', 'showThreadContextMenu', 'showMessageContextMenu', 'setupEditableContextMenu', 'openFile', 'readWindowState', 'writeWindowState', 'trackWindowState'] as const)

// ============================================================================
// THREAD EVENTS (special case: aggregates multiple event channels)
// ============================================================================

type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

const threadEvents = {
  onEvent: (callback: (event: ThreadEvent) => void): (() => void) => {
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
  ai: ModuleAPIs['ai'] & {
    onDelta(callback: (data: { streamId: string; chunk: string }) => void): () => void
    onReasoning(callback: (data: { streamId: string; chunk: string }) => void): () => void
    onComplete(callback: (data: { streamId: string; content: string; reasoning: string; usage: Usage }) => void): () => void
    onError(callback: (data: { streamId: string; error: string }) => void): () => void
  }
  messages: ModuleAPIs['messages']
  personas: ModuleAPIs['personas'] & {
    onCreated(callback: (data: Persona) => void): () => void
    onUpdated(callback: (data: Persona) => void): () => void
    onDeleted(callback: (data: string) => void): () => void
  }
  profiles: ModuleAPIs['profiles'] & {
    onInstalled(callback: (data: ProfileInstallResult) => void): () => void
    onUninstalled(callback: (data: string) => void): () => void
  }
  settings: ModuleAPIs['settings'] & {
    onActivated(callback: (data: string | null) => void): () => void
  }
  threads: ModuleAPIs['threads'] & {
    onEvent(callback: (event: ThreadEvent) => void): () => void
  }
  ui: ModuleAPIs['ui']
  utils: {
    getFilePath(file: File): string
  }
  log: {
    error(tag: string, message: string, stack?: string): void
  }
}

const arcAPI: ArcAPI = {
  ai: {
    ...ai,
    onDelta: createEventSubscription<{ streamId: string; chunk: string }>('arc:ai:delta'),
    onReasoning: createEventSubscription<{ streamId: string; chunk: string }>('arc:ai:reasoning'),
    onComplete: createEventSubscription<{ streamId: string; content: string; reasoning: string; usage: Usage }>('arc:ai:complete'),
    onError: createEventSubscription<{ streamId: string; error: string }>('arc:ai:error'),
  },

  messages,

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
  },

  settings: {
    ...settings,
    onActivated: createEventSubscription<string | null>('arc:settings:activated'),
  },

  threads: {
    ...threads,
    ...threadEvents,
  },

  ui,

  utils: {
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
