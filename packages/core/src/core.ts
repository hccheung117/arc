import type { Platform, IPlatformDatabase, IPlatformHTTP } from "@arc/platform";
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
 * 1. Initializes the database and runs migrations
 * 2. Creates all repositories (SQLite-based)
 * 3. Wires up all feature APIs with their dependencies
 * 4. Returns the unified Core facade
 *
 * @param platform - Platform-specific implementations
 * @returns Fully initialized Core instance
 *
 * @example
 * ```typescript
 * import { createPlatform } from '@arc/platform';
 * import { createCore } from '@arc/core';
 *
 * const platform = await createPlatform('browser');
 * const core = await createCore(platform);
 *
 * // Use the core
 * const chats = await core.chats.list();
 * ```
 */
export async function createCore(platform: Platform): Promise<Core> {
  // 1. Initialize database and run migrations
  const db = await Database.create(platform.database);
  await db.migrate();

  // 2. Create repositories
  const chatRepo = new SQLiteChatRepository(platform.database);
  const messageRepo = new SQLiteMessageRepository(platform.database);
  const providerRepo = new SQLiteProviderConfigRepository(platform.database);
  const settingsRepo = new SQLiteSettingsRepository(platform.database);

  // 3. Initialize provider management
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

  // 4. Create shared message streamer for coordinating stream cancellation
  const messageStreamer = new MessageStreamer();

  // 5. Create feature APIs
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

  // 6. Return the unified facade
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
