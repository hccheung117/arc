import { contextBridge, ipcRenderer } from 'electron'
import type { Message } from '../types/messages'
import type { ArcAPI, EchoResponse, PongEvent } from '../types/arc-api'

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

/**
 * New ArcAPI Surface (M2: window.arc)
 *
 * This is the new IPC surface following the canonical patterns from plan/ipc.md.
 * It will eventually replace electronAPI after M3 migration is complete.
 */
const arc: ArcAPI = {
  // Rule 1: One-Way (Renderer → Main, fire-and-forget)
  log: (message: string) => ipcRenderer.send('arc:log', message),

  // Rule 2: Two-Way (Renderer → Main with response)
  echo: (message: string) => ipcRenderer.invoke('arc:echo', message) as Promise<EchoResponse>,

  // Rule 1: One-Way trigger for Push demo
  ping: () => ipcRenderer.send('arc:ping'),

  // Rule 3: Push (Main → Renderer subscription)
  onPong: (callback: (event: PongEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: PongEvent) => callback(data)
    ipcRenderer.on('arc:pong', listener)
    return () => ipcRenderer.removeListener('arc:pong', listener)
  },
}

contextBridge.exposeInMainWorld('arc', arc)
