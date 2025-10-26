import type { Platform, PlatformDatabase, PlatformHTTP } from "@arc/platform";
import { createPlatform, type PlatformType, type BrowserPlatformOptions, type ElectronPlatformOptions, type CapacitorPlatformOptions } from "@arc/platform";
import type { Provider } from "@arc/ai/provider.js";
import { Database } from "@arc/db/database.js";

// Repositories
import { SQLiteChatRepository } from "./chats/chat-repository-sqlite.js";
import { SQLiteMessageRepository } from "./messages/message-repository-sqlite.js";
import { SQLiteProviderConfigRepository } from "./providers/provider-repository-sqlite.js";
import { SQLiteSettingsRepository } from "./settings/settings-repository-sqlite.js";

// APIs
import { ProvidersAPI } from "./providers/providers-api.js";
import { ChatsAPI } from "./chats/chats-api.js";
import { MessagesAPI } from "./messages/messages-api.js";
import { SearchAPI } from "./search/search-api.js";
import { SettingsAPI } from "./settings/settings-api.js";

// Internal utilities
import { createDefaultRegistry } from "./providers/provider-registry.js";
import { ProviderManager } from "./providers/provider-manager.js";
import { SearchEngine } from "./search/search-engine.js";
import { MessageStreamer } from "./messages/message-streamer.js";

/**
 * Options for creating a Core instance
 */
export interface CoreOptions {
  /**
   * Platform type to use (browser, electron, capacitor, or test)
   */
  platform: PlatformType;

  /**
   * Platform-specific configuration options
   */
  platformOptions?: BrowserPlatformOptions | ElectronPlatformOptions | CapacitorPlatformOptions;
}

/**
 * Core facade - the single entry point for all business logic
 *
 * Provides namespaced APIs for all features:
 * - core.providers: Manage AI provider connections
 * - core.chats: Manage chat sessions
 * - core.messages: Manage individual messages
 * - core.search: Search across messages
 * - core.settings: Manage user preferences
 */
export interface Core {
  /**
   * Manage AI provider connections
   */
  readonly providers: ProvidersAPI;

  /**
   * Manage chat sessions
   */
  readonly chats: ChatsAPI;

  /**
   * Manage individual messages
   */
  readonly messages: MessagesAPI;

  /**
   * Search across messages and chats
   */
  readonly search: SearchAPI;

  /**
   * Manage user preferences
   */
  readonly settings: SettingsAPI;

  /**
   * Close the core and clean up resources
   */
  close(): Promise<void>;
}

/**
 * Create and initialize the Core
 *
 * This async factory function:
 * 1. Creates the appropriate platform instance based on the provided type
 * 2. Initializes the database and runs migrations
 * 3. Creates all repositories (SQLite-based)
 * 4. Wires up all feature APIs with their dependencies
 * 5. Returns the unified Core facade
 *
 * @param options - Core configuration options including platform type
 * @returns Fully initialized Core instance
 *
 * @example
 * ```typescript
 * import { createCore } from '@arc/core';
 *
 * // Browser platform
 * const core = await createCore({ platform: 'browser' });
 *
 * // Electron platform with custom database path
 * const core = await createCore({
 *   platform: 'electron',
 *   platformOptions: { database: { filePath: '/path/to/app.db' } }
 * });
 *
 * // Use the core
 * const chats = await core.chats.list();
 * ```
 */
export async function createCore(options: CoreOptions): Promise<Core> {
  // 1. Create platform instance based on the provided type
  const platform = await createPlatform(options.platform, options.platformOptions as any);

  // 2. Initialize database and run migrations
  const db = await Database.create(platform.database);
  await db.migrate();

  // 3. Create repositories
  const chatRepo = new SQLiteChatRepository(platform.database);
  const messageRepo = new SQLiteMessageRepository(platform.database);
  const providerRepo = new SQLiteProviderConfigRepository(platform.database);
  const settingsRepo = new SQLiteSettingsRepository(platform.database);

  // 4. Initialize provider management
  const providerRegistry = createDefaultRegistry(platform.http);
  const providerManager = new ProviderManager(providerRegistry, platform.http);

  // Helper function to get provider instance from configuration ID
  const getProvider = async (configId: string): Promise<Provider> => {
    const config = await providerRepo.findById(configId);
    if (!config) {
      throw new Error(`Provider configuration ${configId} not found`);
    }
    return providerManager.getProvider(config);
  };

  // 5. Create shared message streamer for coordinating stream cancellation
  const messageStreamer = new MessageStreamer();

  // 6. Create feature APIs
  const providersAPI = new ProvidersAPI(providerRepo, providerManager);

  const chatsAPI = new ChatsAPI(
    chatRepo,
    messageRepo,
    platform.database,
    getProvider,
    messageStreamer
  );

  const messagesAPI = new MessagesAPI(
    messageRepo,
    chatRepo,
    platform.database,
    getProvider,
    messageStreamer
  );

  const searchEngine = new SearchEngine(messageRepo, chatRepo);
  const searchAPI = new SearchAPI(searchEngine, chatRepo);

  const settingsAPI = new SettingsAPI(settingsRepo);

  // 7. Return the unified facade
  return {
    providers: providersAPI,
    chats: chatsAPI,
    messages: messagesAPI,
    search: searchAPI,
    settings: settingsAPI,

    async close() {
      // Clean up resources
      await platform.database.close();
    },
  };
}

// ============================================================================
// Re-export types for UI consumption
// ============================================================================

export type { Chat } from "./chats/chat.js";
export type { Message } from "./messages/message.js";
export type { ImageAttachment } from "./shared/image-attachment.js";
export type { ProviderConfig } from "./providers/provider-config.js";
export type { SearchResult } from "./search/search-engine.js";
export type { Settings } from "./settings/settings.js";
