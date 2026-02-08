/**
 * IPC Preload Module
 *
 * Exposes window.arc API via contextBridge.
 * Module clients are auto-generated via createClient() with types derived from module definitions.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'

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
function createClient(
  moduleName,
  operations
) {
  const client = {}
  for (const op of operations) {
    client[op] = (input) =>
      ipcRenderer.invoke(`arc:${moduleName}:${op}`, input)
  }
  return client
}

// ============================================================================
// MODULE CLIENTS (explicit operation lists for contextBridge compatibility)
// ============================================================================

const ai = createClient('ai', ['stream', 'stop', 'refine', 'fetchModels'])
const messages = createClient('messages', ['list', 'create', 'createBranch', 'update', 'duplicateData', 'deleteData', 'readAttachment', 'getAttachmentPath', 'export', 'getConversation'])
const personas = createClient('personas', ['list', 'get', 'create', 'update', 'delete', 'resolve'])
const profiles = createClient('profiles', ['install', 'uninstall', 'list', 'read', 'readSettings', 'syncModels', 'clearModelsCache', 'listModels', 'getProviderConfig', 'getStreamConfig'])
const settings = createClient('settings', ['activate', 'getActiveProfileId', 'getFavorites', 'setFavorites', 'getAssignments', 'setAssignments', 'getShortcuts', 'setShortcuts'])
const threads = createClient('threads', ['list', 'create', 'update', 'delete', 'duplicate', 'folderThreads', 'moveToFolder', 'moveToRoot', 'reorderInFolder'])
const ui = createClient('ui', ['getMinSize', 'buildAppMenu', 'showThreadContextMenu', 'showMessageContextMenu', 'setupEditableContextMenu', 'openFile', 'readWindowState', 'writeWindowState', 'trackWindowState'])

// ============================================================================
// THREAD EVENTS (special case: aggregates multiple event channels)
// ============================================================================

const threadEvents = {
  onEvent: (callback) => {
    const onCreated = (_, data) =>
      callback({ type: 'created', thread: data })
    const onUpdated = (_, data) =>
      callback({ type: 'updated', thread: data })
    const onDeleted = (_, data) =>
      callback({ type: 'deleted', id: data })
    const onThreadCreated = (_, data) =>
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

const createEventSubscription = (channel) => {
  return (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

// ============================================================================
// ARC API
// ============================================================================

const arcAPI = {
  ai: {
    ...ai,
    onDelta: createEventSubscription('arc:ai:delta'),
    onReasoning: createEventSubscription('arc:ai:reasoning'),
    onComplete: createEventSubscription('arc:ai:complete'),
    onError: createEventSubscription('arc:ai:error'),
  },

  messages,

  personas: {
    ...personas,
    onCreated: createEventSubscription('arc:personas:created'),
    onUpdated: createEventSubscription('arc:personas:updated'),
    onDeleted: createEventSubscription('arc:personas:deleted'),
  },

  profiles: {
    ...profiles,
    onInstalled: createEventSubscription('arc:profiles:installed'),
    onUninstalled: createEventSubscription('arc:profiles:uninstalled'),
  },

  settings: {
    ...settings,
    onActivated: createEventSubscription('arc:settings:activated'),
  },

  threads: {
    ...threads,
    ...threadEvents,
  },

  ui,

  utils: {
    getFilePath: (file) => webUtils.getPathForFile(file),
  },

  log: {
    error: (tag, message, stack) =>
      ipcRenderer.send('arc:log:error', tag, message, stack),
  },
}

contextBridge.exposeInMainWorld('arc', arcAPI)
