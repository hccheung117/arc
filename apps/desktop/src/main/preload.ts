import { contextBridge, ipcRenderer } from 'electron'
import type { Message } from '../shared/messages'

/**
 * IPC Preload Module
 *
 * This file runs in Electron's renderer context (preload script).
 * It MUST NOT import any handlers, database code, or native modules.
 *
 * Constraint: Electron's renderer process (Chromium sandbox) cannot load native
 * modules like better-sqlite3. Even with contextIsolation enabled, preload scripts
 * are bundled for the renderer environment and must remain browser-safe.
 *
 * Responsibilities:
 * - Expose typed IPC methods to the renderer via contextBridge
 * - Wrap ipcRenderer.invoke calls for request/response patterns
 * - Wrap ipcRenderer.on/off for streaming events
 */

interface StreamDeltaEvent {
  streamId: string
  chunk: string
}

interface StreamCompleteEvent {
  streamId: string
  message: Message
}

interface StreamErrorEvent {
  streamId: string
  error: string
}

const electronAPI = {
  // Models
  getModels: () => ipcRenderer.invoke('models:get'),

  // Messages
  getMessages: (conversationId: string) => ipcRenderer.invoke('messages:get', conversationId),
  streamMessage: (conversationId: string, model: string, content: string) =>
    ipcRenderer.invoke('messages:stream', conversationId, model, content),
  cancelStream: (streamId: string) => ipcRenderer.invoke('messages:cancelStream', streamId),

  // Conversations
  getConversationSummaries: () => ipcRenderer.invoke('conversations:getSummaries'),
  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke('conversations:delete', conversationId),
  renameConversation: (conversationId: string, title: string) =>
    ipcRenderer.invoke('conversations:rename', conversationId, title),
  togglePin: (conversationId: string, pinned: boolean) =>
    ipcRenderer.invoke('conversations:togglePin', conversationId, pinned),
  showThreadContextMenu: (currentPinnedState: boolean) =>
    ipcRenderer.invoke('conversations:showContextMenu', currentPinnedState),

  // Providers
  updateProviderConfig: (providerId: string, config: { apiKey?: string; baseUrl?: string }) =>
    ipcRenderer.invoke('providers:updateConfig', providerId, config),
  getProviderConfig: (providerId: string) => ipcRenderer.invoke('providers:getConfig', providerId),

  // Stream event listeners (push from main to renderer)
  onStreamDelta: (callback: (event: StreamDeltaEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: StreamDeltaEvent) => callback(data)
    ipcRenderer.on('message-stream:delta', listener)
    return () => ipcRenderer.removeListener('message-stream:delta', listener)
  },
  onStreamComplete: (callback: (event: StreamCompleteEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: StreamCompleteEvent) => callback(data)
    ipcRenderer.on('message-stream:complete', listener)
    return () => ipcRenderer.removeListener('message-stream:complete', listener)
  },
  onStreamError: (callback: (event: StreamErrorEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: StreamErrorEvent) => callback(data)
    ipcRenderer.on('message-stream:error', listener)
    return () => ipcRenderer.removeListener('message-stream:error', listener)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
