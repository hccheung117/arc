import type {
  PlatformFileSystem,
  PickedFile,
} from "../contracts/filesystem.js";
import { FileSystemError } from "../contracts/errors.js";

/**
 * Type definition for Electron APIs exposed via preload script
 */
interface ElectronAPI {
  fileSystem: {
    pickImages: () => Promise<PickedFile[]>;
    saveAttachment: (
      attachmentId: string,
      chatId: string,
      fileName: string,
      mimeType: string,
      data: string
    ) => Promise<string>;
    loadAttachment: (storagePath: string) => Promise<string>;
    deleteAttachment: (storagePath: string) => Promise<void>;
    deleteAttachmentsForChat: (chatId: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

/**
 * Electron file system implementation
 *
 * Uses IPC to communicate with the main process for file operations.
 * Attachments are stored in the user data directory.
 *
 * This implementation delegates to the Electron main process via the
 * preload script's exposed API for security and proper file system access.
 */
export class ElectronFileSystem implements PlatformFileSystem {
  private ensureElectronAPI(): ElectronAPI {
    if (typeof window === "undefined" || !window.electron) {
      throw new FileSystemError(
        "ElectronFileSystem can only be used in Electron renderer process"
      );
    }
    return window.electron;
  }

  async pickImages(options?: { multiple?: boolean }): Promise<PickedFile[]> {
    try {
      const electron = this.ensureElectronAPI();
      const files = await electron.fileSystem.pickImages();

      // If multiple is false, return only the first file
      if (options?.multiple === false && files.length > 0) {
        return [files[0]!];
      }

      return files;
    } catch (error) {
      throw new FileSystemError(
        "Failed to pick images",
        undefined,
        error
      );
    }
  }

  async saveAttachment(
    attachmentId: string,
    chatId: string,
    fileName: string,
    mimeType: string,
    data: string | Buffer
  ): Promise<string> {
    try {
      const electron = this.ensureElectronAPI();

      // Convert Buffer to base64 string if needed
      const dataString =
        typeof data === "string" ? data : data.toString("base64");

      return await electron.fileSystem.saveAttachment(
        attachmentId,
        chatId,
        fileName,
        mimeType,
        dataString
      );
    } catch (error) {
      throw new FileSystemError(
        `Failed to save attachment: ${fileName}`,
        `${chatId}/${attachmentId}`,
        error
      );
    }
  }

  async loadAttachment(storagePath: string): Promise<string> {
    try {
      const electron = this.ensureElectronAPI();
      return await electron.fileSystem.loadAttachment(storagePath);
    } catch (error) {
      throw new FileSystemError(
        "Failed to load attachment",
        storagePath,
        error
      );
    }
  }

  async deleteAttachment(storagePath: string): Promise<void> {
    try {
      const electron = this.ensureElectronAPI();
      await electron.fileSystem.deleteAttachment(storagePath);
    } catch (error) {
      throw new FileSystemError(
        "Failed to delete attachment",
        storagePath,
        error
      );
    }
  }

  async deleteAttachmentsForChat(chatId: string): Promise<void> {
    try {
      const electron = this.ensureElectronAPI();
      await electron.fileSystem.deleteAttachmentsForChat(chatId);
    } catch (error) {
      throw new FileSystemError(
        "Failed to delete attachments for chat",
        chatId,
        error
      );
    }
  }
}
