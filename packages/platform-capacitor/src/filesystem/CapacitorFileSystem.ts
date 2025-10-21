import type {
  IPlatformFileSystem,
  PickedFile,
} from "@arc/core/platform/IPlatformFileSystem.js";

/**
 * Capacitor platform file system implementation
 *
 * TODO: Implement using Capacitor plugins:
 * - @capacitor/filesystem for file I/O
 * - @capacitor/camera for image picking (optional)
 * - @capacitor/file-picker for general file picking
 *
 * Storage strategy:
 * - Use Filesystem.writeFile() to save attachments to DATA directory
 * - Organize files by chat: /attachments/{chatId}/{attachmentId}.ext
 * - Store metadata in SQLite database
 */
export class CapacitorFileSystem implements IPlatformFileSystem {
  constructor() {
    // TODO: Initialize Capacitor filesystem
    // - Import necessary plugins
    // - Set up base directory paths
    // - Ensure attachments directory exists
  }

  /**
   * Open file picker to select images
   *
   * TODO: Implement image picking
   * - Use @capacitor/camera or @capacitor/file-picker
   * - Handle multiple file selection if requested
   * - Read file data and convert to base64
   * - Extract file metadata (name, size, MIME type)
   */
  async pickImages(options?: {
    multiple?: boolean;
  }): Promise<PickedFile[]> {
    throw new Error("CapacitorFileSystem.pickImages() not implemented yet");
  }

  /**
   * Save attachment to device storage
   *
   * TODO: Implement attachment storage
   * - Create chat-specific directory if needed
   * - Decode base64 data if necessary
   * - Write file to filesystem using Filesystem.writeFile()
   * - Return storage path: "attachments/{chatId}/{attachmentId}.ext"
   */
  async saveAttachment(
    attachmentId: string,
    chatId: string,
    fileName: string,
    mimeType: string,
    data: string | Buffer
  ): Promise<string> {
    throw new Error("CapacitorFileSystem.saveAttachment() not implemented yet");
  }

  /**
   * Load attachment from device storage
   *
   * TODO: Implement attachment loading
   * - Read file from filesystem using Filesystem.readFile()
   * - Return base64-encoded data
   * - Handle file not found errors
   */
  async loadAttachment(storagePath: string): Promise<string> {
    throw new Error("CapacitorFileSystem.loadAttachment() not implemented yet");
  }

  /**
   * Delete a single attachment
   *
   * TODO: Implement attachment deletion
   * - Delete file using Filesystem.deleteFile()
   * - Ignore errors if file doesn't exist
   */
  async deleteAttachment(storagePath: string): Promise<void> {
    throw new Error("CapacitorFileSystem.deleteAttachment() not implemented yet");
  }

  /**
   * Delete all attachments for a chat
   *
   * TODO: Implement bulk deletion
   * - List all files in attachments/{chatId}/ directory
   * - Delete each file
   * - Remove empty directory
   * - Handle errors gracefully
   */
  async deleteAttachmentsForChat(chatId: string): Promise<void> {
    throw new Error("CapacitorFileSystem.deleteAttachmentsForChat() not implemented yet");
  }
}
