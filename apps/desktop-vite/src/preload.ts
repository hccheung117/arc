import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from './shared/types';

/**
 * IPC Bridge
 *
 * Exposes a type-safe API to the renderer process via contextBridge.
 * All communication between Renderer and Main must go through this bridge.
 */
const electronAPI: ElectronAPI = {
  sayHello: () => ipcRenderer.invoke('app:hello'),
};

contextBridge.exposeInMainWorld('electron', electronAPI);
