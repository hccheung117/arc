/**
 * IPC response for the hello demo.
 * Demonstrates typed communication between Main and Renderer processes.
 */
export interface HelloResponse {
  message: string;
  timestamp: string;
}

/**
 * Type definition for the electron API exposed to the renderer.
 * Extend this interface as more IPC methods are added.
 */
export interface ElectronAPI {
  sayHello: () => Promise<HelloResponse>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
