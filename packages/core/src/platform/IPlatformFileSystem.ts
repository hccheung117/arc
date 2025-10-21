/**
 * Platform file system abstraction
 *
 * Provides file picking, saving, and attachment management capabilities
 * for platforms that have native file system access (desktop, mobile).
 * Web platforms may provide limited implementations or throw errors.
 */

/**
 * Result of a file picker operation
 */
export interface PickedFile {
  /**
   * File name with extension
   */
  name: string;
  /**
   * MIME type of the file
   */
  mimeType: string;
  /**
   * File size in bytes
   */
  size: number;
  /**
   * File data as base64-encoded string
   */
  data: string;
}

/**
 * Attachment metadata stored in database
 */
export interface AttachmentMetadata {
  /**
   * Unique attachment ID
   */
  id: string;
  /**
   * Chat ID this attachment belongs to
   */
  chatId: string;
  /**
   * Original file name
   */
  name: string;
  /**
   * MIME type
   */
  mimeType: string;
  /**
   * File size in bytes
   */
  size: number;
  /**
   * Platform-specific storage path or identifier
   * For desktop: relative path like "attachments/{chatId}/{id}.png"
   * For web: could be an IndexedDB key
   */
  storagePath: string;
}

/**
 * Platform file system interface
 *
 * Implementations must handle:
 * - File picker dialogs
 * - Secure attachment storage
 * - Attachment retrieval
 * - Cleanup of deleted attachments
 */
export interface IPlatformFileSystem {
  /**
   * Open a file picker dialog to select images
   *
   * @param options - Picker options (multi-select, accepted types)
   * @returns Array of picked files with data
   * @throws Error if user cancels or picker fails
   */
  pickImages(options?: {
    multiple?: boolean;
  }): Promise<PickedFile[]>;

  /**
   * Save an attachment to platform-specific storage
   *
   * @param attachment - Attachment metadata and data
   * @param data - File data as Buffer or base64 string
   * @returns Storage path or identifier for the saved file
   * @throws Error if save operation fails
   */
  saveAttachment(
    attachmentId: string,
    chatId: string,
    fileName: string,
    mimeType: string,
    data: string | Buffer
  ): Promise<string>;

  /**
   * Load an attachment from storage
   *
   * @param storagePath - Platform-specific path or identifier
   * @returns File data as base64-encoded string
   * @throws Error if file not found or read fails
   */
  loadAttachment(storagePath: string): Promise<string>;

  /**
   * Delete an attachment from storage
   *
   * @param storagePath - Platform-specific path or identifier
   * @throws Error if delete operation fails (non-existent files are ignored)
   */
  deleteAttachment(storagePath: string): Promise<void>;

  /**
   * Delete all attachments for a chat
   *
   * @param chatId - Chat ID
   * @throws Error if delete operation fails
   */
  deleteAttachmentsForChat(chatId: string): Promise<void>;
}
