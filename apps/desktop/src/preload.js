import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

  // Event listeners
  /**
   * @param {string} channel
   * @param {(...args: any[]) => void} callback
   */
  on: (channel, callback) => {
    // Whitelist of allowed channels
    const validChannels = ['show-update-dialog'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  /**
   * @param {string} channel
   * @param {(...args: any[]) => void} callback
   */
  off: (channel, callback) => {
    const validChannels = ['show-update-dialog'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },

  // File system APIs
  fileSystem: {
    /**
     * Open file picker dialog for images
     * @returns {Promise<Array<{name: string, mimeType: string, size: number, data: string}>>}
     */
    pickImages: () => ipcRenderer.invoke('dialog:openFile'),

    /**
     * Save an attachment to file system
     * @param {string} attachmentId - Unique attachment ID
     * @param {string} chatId - Chat ID
     * @param {string} fileName - Original file name
     * @param {string} mimeType - MIME type
     * @param {string} data - Base64 data or data URL
     * @returns {Promise<string>} Storage path
     */
    saveAttachment: (attachmentId, chatId, fileName, mimeType, data) =>
      ipcRenderer.invoke('fs:saveAttachment', attachmentId, chatId, fileName, mimeType, data),

    /**
     * Load an attachment from file system
     * @param {string} storagePath - Relative storage path
     * @returns {Promise<string>} Base64-encoded file data
     */
    loadAttachment: (storagePath) =>
      ipcRenderer.invoke('fs:loadAttachment', storagePath),

    /**
     * Delete an attachment from file system
     * @param {string} storagePath - Relative storage path
     * @returns {Promise<void>}
     */
    deleteAttachment: (storagePath) =>
      ipcRenderer.invoke('fs:deleteAttachment', storagePath),

    /**
     * Delete all attachments for a chat
     * @param {string} chatId - Chat ID
     * @returns {Promise<void>}
     */
    deleteAttachmentsForChat: (chatId) =>
      ipcRenderer.invoke('fs:deleteAttachmentsForChat', chatId),
  },

  // App APIs
  app: {
    /**
     * Get app version
     * @returns {Promise<string>}
     */
    getVersion: () => ipcRenderer.invoke('app:getVersion'),

    /**
     * Get user data path
     * @returns {Promise<string>}
     */
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  },

  // Updates APIs
  updates: {
    /**
     * Check for updates from GitHub releases
     * @returns {Promise<{hasUpdate: boolean, currentVersion: string, latestVersion: string, releaseNotes: string, downloadUrl: string}>}
     */
    check: () => ipcRenderer.invoke('updates:check'),
  },
});
