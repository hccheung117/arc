import type { IpcMain } from 'electron'
import { getModels } from '../models/handlers'
import { getMessages } from '../messages/handlers'
import { streamMessage, cancelStream } from '../messages/stream-handler'
import {
  getConversationSummaries,
  deleteConversation,
  renameConversation,
  toggleConversationPin,
} from '../conversations/handlers'
import { updateProviderConfig, getProviderConfig } from '../providers/handlers'
import { showThreadContextMenu } from '../ui/context-menu'

/**
 * IPC Main Process Module
 *
 * This file runs in Electron's main process (Node.js environment).
 * It imports handlers that use native modules (database, file system, etc.).
 *
 * Responsibilities:
 * - Import handler implementations (which may use native modules)
 * - Register IPC handlers with ipcMain.handle
 * - Bridge renderer requests to main process services
 */

export function registerAllIPC(ipcMain: IpcMain): void {
  // Models
  ipcMain.handle('models:get', () => getModels())

  // Messages
  ipcMain.handle('messages:get', (_, conversationId: string) => getMessages(conversationId))
  ipcMain.handle('messages:stream', (event, conversationId: string, model: string, content: string) => {
    return streamMessage(event.sender, conversationId, model, content)
  })
  ipcMain.handle('messages:cancelStream', (_, streamId: string) => cancelStream(streamId))

  // Conversations
  ipcMain.handle('conversations:getSummaries', () => getConversationSummaries())
  ipcMain.handle('conversations:delete', (_, conversationId: string) => deleteConversation(conversationId))
  ipcMain.handle('conversations:rename', (_, conversationId: string, title: string) =>
    renameConversation(conversationId, title),
  )
  ipcMain.handle('conversations:togglePin', (_, conversationId: string, pinned: boolean) =>
    toggleConversationPin(conversationId, pinned),
  )
  ipcMain.handle('conversations:showContextMenu', (_, currentPinnedState: boolean) =>
    showThreadContextMenu(currentPinnedState),
  )

  // Providers
  ipcMain.handle('providers:updateConfig', (_, providerId: string, config: { apiKey?: string; baseUrl?: string }) =>
    updateProviderConfig(providerId, config),
  )
  ipcMain.handle('providers:getConfig', (_, providerId: string) => getProviderConfig(providerId))
}
