import { contextBridge, ipcRenderer } from 'electron'
import type { MessageStreamHandle } from '@arc/contracts/src/messages'
import { createElectronAPI } from './ipc-preload'

contextBridge.exposeInMainWorld('electronAPI', {
  ...createElectronAPI(ipcRenderer),

  streamAssistantMessage: (conversationId: string, content: string): MessageStreamHandle => {
    throw new Error('Streaming not yet implemented via IPC')
  },
})
