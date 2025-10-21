/**
 * Type definitions for Electron APIs exposed via preload script
 */

interface ElectronFileSystemAPI {
  pickImages: () => Promise<
    Array<{
      name: string;
      mimeType: string;
      size: number;
      data: string;
    }>
  >;
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
}

interface ElectronAppAPI {
  getVersion: () => Promise<string>;
  getUserDataPath: () => Promise<string>;
}

interface ElectronUpdatesAPI {
  check: () => Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseNotes: string | null;
    downloadUrl: string | null;
    publishedAt?: string;
    error?: string;
  }>;
}

interface ElectronAPI {
  platform: string;
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
  fileSystem: ElectronFileSystemAPI;
  app: ElectronAppAPI;
  updates: ElectronUpdatesAPI;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
