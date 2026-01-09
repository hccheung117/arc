import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  ArcAPI,
  ThreadPatch,
  ThreadEvent,
  CreateMessageInput,
  CreateBranchInput,
  UpdateMessageInput,
  ChatOptions,
  AIStreamEvent,
  ModelsEvent,
  ThreadContextMenuParams,
} from '@arc-types/arc-api'
import type { ProfilesEvent } from '@arc-types/arc-file'

/**
 * IPC Preload Module
 *
 * Exposes the typed window.arc API to the renderer via contextBridge.
 * This file runs in Electron's preload context and must remain browser-safe.
 */

const arcAPI: ArcAPI = {
  threads: {
    list: () => ipcRenderer.invoke('arc:threads:list'),

    update: (id: string, patch: ThreadPatch) =>
      ipcRenderer.invoke('arc:threads:update', id, patch),

    delete: (id: string) => ipcRenderer.invoke('arc:threads:delete', id),

    onEvent: (callback: (event: ThreadEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ThreadEvent) => callback(data)
      ipcRenderer.on('arc:threads:event', listener)
      return () => ipcRenderer.removeListener('arc:threads:event', listener)
    },
  },

  folders: {
    create: (name: string, thread1Id: string, thread2Id: string) =>
      ipcRenderer.invoke('arc:folders:create', name, thread1Id, thread2Id),

    createWithThread: (threadId: string) =>
      ipcRenderer.invoke('arc:folders:createWithThread', threadId),

    moveThread: (threadId: string, folderId: string) =>
      ipcRenderer.invoke('arc:folders:moveThread', threadId, folderId),

    moveToRoot: (threadId: string) =>
      ipcRenderer.invoke('arc:folders:moveToRoot', threadId),

    reorder: (folderId: string, orderedChildIds: string[]) =>
      ipcRenderer.invoke('arc:folders:reorder', folderId, orderedChildIds),
  },

  messages: {
    list: (threadId: string) =>
      ipcRenderer.invoke('arc:messages:list', threadId),

    create: (threadId: string, input: CreateMessageInput) =>
      ipcRenderer.invoke('arc:messages:create', threadId, input),

    createBranch: (threadId: string, input: CreateBranchInput) =>
      ipcRenderer.invoke('arc:messages:createBranch', threadId, input),

    update: (threadId: string, messageId: string, input: UpdateMessageInput) =>
      ipcRenderer.invoke('arc:messages:update', threadId, messageId, input),
  },

  models: {
    list: () => ipcRenderer.invoke('arc:models:list'),

    onEvent: (callback: (event: ModelsEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ModelsEvent) => callback(data)
      ipcRenderer.on('arc:models:event', listener)
      return () => ipcRenderer.removeListener('arc:models:event', listener)
    },
  },

  ai: {
    chat: (threadId: string, options: ChatOptions) =>
      ipcRenderer.invoke('arc:ai:chat', threadId, options),

    stop: (streamId: string) => ipcRenderer.invoke('arc:ai:stop', streamId),

    onEvent: (callback: (event: AIStreamEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: AIStreamEvent) => callback(data)
      ipcRenderer.on('arc:ai:event', listener)
      return () => ipcRenderer.removeListener('arc:ai:event', listener)
    },
  },

  settings: {
    get: <T = unknown>(key: string) =>
      ipcRenderer.invoke('arc:settings:get', key) as Promise<T | null>,

    set: <T = unknown>(key: string, value: T) =>
      ipcRenderer.invoke('arc:settings:set', key, value),
  },

  ui: {
    showThreadContextMenu: (params: ThreadContextMenuParams) =>
      ipcRenderer.invoke('arc:ui:showThreadContextMenu', params),
    showMessageContextMenu: (hasEditOption: boolean) =>
      ipcRenderer.invoke('arc:ui:showMessageContextMenu', hasEditOption),
  },

  profiles: {
    list: () => ipcRenderer.invoke('arc:profiles:list'),

    getActive: () => ipcRenderer.invoke('arc:profiles:getActive'),

    install: (filePath: string) => ipcRenderer.invoke('arc:profiles:install', filePath),

    uninstall: (profileId: string) => ipcRenderer.invoke('arc:profiles:uninstall', profileId),

    activate: (profileId: string | null) => ipcRenderer.invoke('arc:profiles:activate', profileId),

    onEvent: (callback: (event: ProfilesEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ProfilesEvent) => callback(data)
      ipcRenderer.on('arc:profiles:event', listener)
      return () => ipcRenderer.removeListener('arc:profiles:event', listener)
    },
  },

  utils: {
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    openFile: (filePath: string) => ipcRenderer.invoke('arc:utils:openFile', filePath),
    getThreadAttachmentPath: (threadId: string, relativePath: string) =>
      ipcRenderer.invoke('arc:utils:getThreadAttachmentPath', threadId, relativePath),
  },

  log: {
    error: (tag: string, message: string, stack?: string) =>
      ipcRenderer.send('arc:log:error', tag, message, stack),
  },
}

contextBridge.exposeInMainWorld('arc', arcAPI)
