/**
 * IPC Preload Module
 *
 * Exposes window.arc API via contextBridge.
 * Contract-based operations are generated from contracts.
 * Events and special cases are manually defined.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { createClient } from '@main/foundation/contract'
import { threadsContract, foldersContract } from '@contracts/threads'
import { messagesContract } from '@contracts/messages'
import { personasContract } from '@contracts/personas'
import { profilesContract } from '@contracts/profiles'
import { settingsContract, type SettingsAPI } from '@contracts/settings'
import { modelsContract } from '@contracts/models'
import { aiContract } from '@contracts/ai'
import { uiContract } from '@contracts/ui'
import { utilsContract } from '@contracts/utils'
import { filesContract } from '@contracts/files'
import type { ThreadEvent, PersonasEvent, ProfilesEvent, AIStreamEvent, Unsubscribe } from '@contracts/events'

// ============================================================================
// CONTRACT-GENERATED CLIENTS
// ============================================================================

const threads = createClient(ipcRenderer, threadsContract)
const folders = createClient(ipcRenderer, foldersContract)
const messages = createClient(ipcRenderer, messagesContract)
const personas = createClient(ipcRenderer, personasContract)
const profiles = createClient(ipcRenderer, profilesContract)
const settings = createClient(ipcRenderer, settingsContract) as SettingsAPI
const models = createClient(ipcRenderer, modelsContract)
const ai = createClient(ipcRenderer, aiContract)
const ui = createClient(ipcRenderer, uiContract)
const utils = createClient(ipcRenderer, utilsContract)
const files = createClient(ipcRenderer, filesContract)

// ============================================================================
// EVENT SUBSCRIPTIONS (manual - not part of contracts)
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
  threads: typeof threads & {
    onEvent(callback: (event: ThreadEvent) => void): Unsubscribe
  }
  folders: typeof folders
  messages: typeof messages
  models: typeof models
  ai: typeof ai & {
    onEvent(callback: (event: AIStreamEvent) => void): Unsubscribe
  }
  settings: SettingsAPI
  ui: typeof ui
  personas: typeof personas & {
    onEvent(callback: (event: PersonasEvent) => void): Unsubscribe
  }
  profiles: typeof profiles & {
    onEvent(callback: (event: ProfilesEvent) => void): Unsubscribe
  }
  utils: typeof utils & {
    /** Sync method - not IPC based */
    getFilePath(file: File): string
  }
  log: {
    /** One-way: fire-and-forget logging */
    error(tag: string, message: string, stack?: string): void
  }
  files: typeof files
}

const arcAPI: ArcAPI = {
  threads: {
    ...threads,
    onEvent: createEventSubscription<ThreadEvent>('arc:threads:event'),
  },

  folders,

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
