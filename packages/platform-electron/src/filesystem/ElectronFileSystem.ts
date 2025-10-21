import type { IPlatformFileSystem } from "@arc/core/platform/IPlatformFileSystem.js";
import type { PickedFile } from "@arc/core/platform/IPlatformFileSystem.js";

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
 */
export class ElectronFileSystem implements IPlatformFileSystem {
  private ensureElectronAPI(): ElectronAPI {
    if (typeof window === "undefined" || !window.electron) {
      throw new Error(
        "ElectronFileSystem can only be used in Electron renderer process"
      );
    }
    return window.electron;
  }

  async pickImages(options?: { multiple?: boolean }): Promise<PickedFile[]> {
    const electron = this.ensureElectronAPI();
    const files = await electron.fileSystem.pickImages();

    // If multiple is false, return only the first file
    if (options?.multiple === false && files.length > 0) {
      return [files[0]!];
    }

    return files;
  }

  async saveAttachment(
    attachmentId: string,
    chatId: string,
    fileName: string,
    mimeType: string,
    data: string | Buffer
  ): Promise<string> {
    const electron = this.ensureElectronAPI();

    // Convert Buffer to base64 string if needed
    const dataString =
      typeof data === "string" ? data : data.toString("base64");

    return electron.fileSystem.saveAttachment(
      attachmentId,
      chatId,
      fileName,
      mimeType,
      dataString
    );
  }

  async loadAttachment(storagePath: string): Promise<string> {
    const electron = this.ensureElectronAPI();
    return electron.fileSystem.loadAttachment(storagePath);
  }

  async deleteAttachment(storagePath: string): Promise<void> {
    const electron = this.ensureElectronAPI();
    return electron.fileSystem.deleteAttachment(storagePath);
  }

  async deleteAttachmentsForChat(chatId: string): Promise<void> {
    const electron = this.ensureElectronAPI();
    return electron.fileSystem.deleteAttachmentsForChat(chatId);
  }
}
