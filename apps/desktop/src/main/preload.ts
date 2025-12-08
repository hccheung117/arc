import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  ArcAPI,
  ConversationPatch,
  ConversationEvent,
  CreateMessageInput,
  CreateBranchInput,
  UpdateMessageInput,
  ChatOptions,
  AIStreamEvent,
  ModelsEvent,
} from '@arc-types/arc-api'
import type { ArcImportEvent, ProfilesEvent } from '@arc-types/arc-file'

/**
 * IPC Preload Module
 *
 * Exposes the typed window.arc API to the renderer via contextBridge.
 * This file runs in Electron's preload context and must remain browser-safe.
 */

const arc: ArcAPI = {
  conversations: {
    list: () => ipcRenderer.invoke('arc:conversations:list'),

    update: (id: string, patch: ConversationPatch) =>
      ipcRenderer.invoke('arc:conversations:update', id, patch),

    delete: (id: string) => ipcRenderer.invoke('arc:conversations:delete', id),

    onEvent: (callback: (event: ConversationEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ConversationEvent) => callback(data)
      ipcRenderer.on('arc:conversations:event', listener)
      return () => ipcRenderer.removeListener('arc:conversations:event', listener)
    },
  },

  messages: {
    list: (conversationId: string) =>
      ipcRenderer.invoke('arc:messages:list', conversationId),

    create: (conversationId: string, input: CreateMessageInput) =>
      ipcRenderer.invoke('arc:messages:create', conversationId, input),

    createBranch: (conversationId: string, input: CreateBranchInput) =>
      ipcRenderer.invoke('arc:messages:createBranch', conversationId, input),

    update: (conversationId: string, messageId: string, input: UpdateMessageInput) =>
      ipcRenderer.invoke('arc:messages:update', conversationId, messageId, input),
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
    chat: (conversationId: string, options: ChatOptions) =>
      ipcRenderer.invoke('arc:ai:chat', conversationId, options),

    stop: (streamId: string) => ipcRenderer.invoke('arc:ai:stop', streamId),

    onEvent: (callback: (event: AIStreamEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: AIStreamEvent) => callback(data)
      ipcRenderer.on('arc:ai:event', listener)
      return () => ipcRenderer.removeListener('arc:ai:event', listener)
    },
  },

  config: {
    get: <T = unknown>(key: string) =>
      ipcRenderer.invoke('arc:config:get', key) as Promise<T | null>,

    set: <T = unknown>(key: string, value: T) =>
      ipcRenderer.invoke('arc:config:set', key, value),
  },

  ui: {
    showThreadContextMenu: (isPinned: boolean) =>
      ipcRenderer.invoke('arc:ui:showThreadContextMenu', isPinned),
    showMessageContextMenu: (content: string, hasEditOption: boolean) =>
      ipcRenderer.invoke('arc:ui:showMessageContextMenu', content, hasEditOption),
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

  import: {
    file: (filePath: string) => ipcRenderer.invoke('arc:import:file', filePath),

    onEvent: (callback: (event: ArcImportEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ArcImportEvent) => callback(data)
      ipcRenderer.on('arc:import:event', listener)
      return () => ipcRenderer.removeListener('arc:import:event', listener)
    },
  },

  utils: {
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    openFile: (filePath: string) => ipcRenderer.invoke('arc:utils:openFile', filePath),
    getAttachmentPath: (conversationId: string, relativePath: string) =>
      ipcRenderer.invoke('arc:utils:getAttachmentPath', conversationId, relativePath),
  },

  log: {
    error: (tag: string, message: string, stack?: string) =>
      ipcRenderer.send('arc:log:error', tag, message, stack),
  },
}

contextBridge.exposeInMainWorld('arc', arc)
