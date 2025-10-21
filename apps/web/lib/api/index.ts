/**
 * Platform-aware Chat API provider
 *
 * Automatically selects the appropriate ChatAPI implementation based on
 * the runtime environment:
 * - Electron: DesktopChatAPI (file-backed SQLite + file system attachments)
 * - Web: LiveChatAPI (sql.js + IndexedDB)
 */

import type { IChatAPI } from "./chat-api.interface";

/**
 * Detect if we're running in Electron
 */
export function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.electron !== "undefined"
  );
}

/**
 * Get the appropriate ChatAPI implementation for the current platform
 *
 * @returns Promise resolving to a ChatAPI instance
 */
export async function getChatAPI(): Promise<IChatAPI> {
  if (isElectron()) {
    // Running in Electron - use desktop implementation
    const { DesktopChatAPI } = await import("./desktop-chat-api");
    return new DesktopChatAPI();
  } else {
    // Running in web browser - use web implementation
    const { LiveChatAPI } = await import("./live-chat-api");
    return new LiveChatAPI();
  }
}

/**
 * Singleton instance for the current platform
 */
let chatAPIInstance: IChatAPI | null = null;

/**
 * Get or create the singleton ChatAPI instance
 *
 * This ensures we only have one ChatAPI instance per app lifecycle,
 * which is important for maintaining database connections and state.
 *
 * @returns Promise resolving to the singleton ChatAPI instance
 */
export async function getChatAPIInstance(): Promise<IChatAPI> {
  if (!chatAPIInstance) {
    chatAPIInstance = await getChatAPI();
  }
  return chatAPIInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetChatAPIInstance(): void {
  chatAPIInstance = null;
}

// Re-export types
export type { IChatAPI, ApiMode } from "./chat-api.interface";
