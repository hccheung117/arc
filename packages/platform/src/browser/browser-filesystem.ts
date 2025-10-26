import type {
  PlatformFileSystem,
  PickedFile,
} from "../contracts/filesystem.js";
import { FileSystemError } from "../contracts/errors.js";

/**
 * Browser platform filesystem implementation
 *
 * Provides limited file system support for browsers:
 * - File picker using <input type="file">
 * - Limited attachment storage (could use IndexedDB, not implemented yet)
 *
 * Note: Full file system access is not available in browsers without
 * user interaction for each operation, unlike desktop platforms.
 */
export class BrowserFileSystem implements PlatformFileSystem {
  /**
   * Open a file picker dialog to select images
   *
   * Uses HTML5 file input to let users pick files.
   */
  async pickImages(options?: { multiple?: boolean }): Promise<PickedFile[]> {
    return new Promise((resolve, reject) => {
      // Create file input element
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = options?.multiple ?? false;
      input.style.display = "none";

      // Handle file selection
      input.onchange = async () => {
        try {
          const files = Array.from(input.files || []);
          if (files.length === 0) {
            reject(new FileSystemError("No files selected"));
            return;
          }

          const pickedFiles: PickedFile[] = await Promise.all(
            files.map(async (file) => {
              const data = await this.fileToBase64(file);
              return {
                name: file.name,
                mimeType: file.type,
                size: file.size,
                data,
              };
            })
          );

          resolve(pickedFiles);
        } catch (error) {
          reject(
            new FileSystemError(
              "Failed to read selected files",
              undefined,
              error
            )
          );
        } finally {
          // Cleanup
          document.body.removeChild(input);
        }
      };

      // Handle cancel
      input.oncancel = () => {
        document.body.removeChild(input);
        reject(new FileSystemError("File picker cancelled"));
      };

      // Add to DOM and trigger
      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Save an attachment to browser storage
   *
   * TODO: Implement IndexedDB-based attachment storage for browsers
   */
  async saveAttachment(
    attachmentId: string,
    chatId: string,
    fileName: string,
    mimeType: string,
    data: string | Buffer
  ): Promise<string> {
    throw new FileSystemError(
      "Browser attachment storage not yet implemented. Use desktop or mobile platform for file attachments."
    );
  }

  /**
   * Load an attachment from browser storage
   *
   * TODO: Implement IndexedDB-based attachment retrieval
   */
  async loadAttachment(storagePath: string): Promise<string> {
    throw new FileSystemError(
      "Browser attachment storage not yet implemented. Use desktop or mobile platform for file attachments."
    );
  }

  /**
   * Delete an attachment from browser storage
   *
   * TODO: Implement IndexedDB-based attachment deletion
   */
  async deleteAttachment(storagePath: string): Promise<void> {
    throw new FileSystemError(
      "Browser attachment storage not yet implemented. Use desktop or mobile platform for file attachments."
    );
  }

  /**
   * Delete all attachments for a chat
   *
   * TODO: Implement IndexedDB-based bulk attachment deletion
   */
  async deleteAttachmentsForChat(chatId: string): Promise<void> {
    throw new FileSystemError(
      "Browser attachment storage not yet implemented. Use desktop or mobile platform for file attachments."
    );
  }

  /**
   * Convert a File object to base64 string
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      reader.readAsDataURL(file);
    });
  }
}
