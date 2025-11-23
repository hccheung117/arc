import { contextBridge, ipcRenderer } from 'electron'
import type {
  ArcAPI,
  ConversationPatch,
  ConversationEvent,
  CreateMessageInput,
  ChatOptions,
  AIStreamEvent,
} from '../types/arc-api'

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
  },

  models: {
    list: () => ipcRenderer.invoke('arc:models:list'),
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
  },
}

contextBridge.exposeInMainWorld('arc', arc)
