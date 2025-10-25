import type {
  IPlatformFileSystem,
  PickedFile,
} from "../contracts/filesystem.js";
import { FileSystemError } from "../contracts/errors.js";

/**
 * Capacitor platform filesystem implementation (STUB)
 *
 * TODO: Implement using @capacitor/filesystem plugin
 *
 * This is a stub implementation that throws "not implemented" errors.
 * The full implementation will use the Capacitor Filesystem plugin to provide
 * native file access on iOS and Android.
 *
 * Planned implementation:
 * - Use @capacitor/filesystem for file I/O operations
 * - Use native image picker for pickImages()
 * - Store attachments in app's document directory
 * - Support both iOS and Android platforms
 *
 * @see https://capacitorjs.com/docs/apis/filesystem
 */
export class CapacitorFileSystem implements IPlatformFileSystem {
  async pickImages(options?: { multiple?: boolean }): Promise<PickedFile[]> {
    throw new FileSystemError(
      "Capacitor filesystem not yet implemented. Use @capacitor/filesystem and native image picker."
    );
  }

  async saveAttachment(
    attachmentId: string,
    chatId: string,
    fileName: string,
    mimeType: string,
    data: string | Buffer
  ): Promise<string> {
    throw new FileSystemError(
      "Capacitor filesystem not yet implemented. Use @capacitor/filesystem plugin.",
      `${chatId}/${attachmentId}`
    );
  }

  async loadAttachment(storagePath: string): Promise<string> {
    throw new FileSystemError(
      "Capacitor filesystem not yet implemented. Use @capacitor/filesystem plugin.",
      storagePath
    );
  }

  async deleteAttachment(storagePath: string): Promise<void> {
    throw new FileSystemError(
      "Capacitor filesystem not yet implemented. Use @capacitor/filesystem plugin.",
      storagePath
    );
  }

  async deleteAttachmentsForChat(chatId: string): Promise<void> {
    throw new FileSystemError(
      "Capacitor filesystem not yet implemented. Use @capacitor/filesystem plugin.",
      chatId
    );
  }
}
