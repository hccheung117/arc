/**
 * LiveChatAPI - Core-backed implementation with persistent SQLite storage
 *
 * Uses sql.js (WASM) in the browser via @arc/platform-browser and the shared
 * repository implementations from @arc/db to persist chats and messages.
 * Data is stored in IndexedDB so it survives page reloads in Live mode.
 */

import type { IChatAPI, ModelInfo } from "./chat-api.interface";
import type { ImageAttachment } from "../types";
// import type { ProviderConfig } from "../chat-store";
import { ChatService, type SearchResult } from "@arc/core/services/ChatService.js";
import { OpenAIProvider } from "@arc/ai/openai/OpenAIProvider.js";
import { AnthropicProvider } from "@arc/ai/anthropic/AnthropicProvider.js";
import { GeminiProvider } from "@arc/ai/gemini/GeminiProvider.js";
import { ProviderRouter } from "./provider-router";
import { ProviderError } from "@arc/core/domain/ProviderError.js";
import type { Chat as CoreChat } from "@arc/core/domain/Chat.js";
import type { Message as CoreMessage } from "@arc/core/domain/Message.js";
import type { IPlatformDatabase } from "@arc/core/platform/IPlatformDatabase.js";
import { runMigrations } from "@arc/db/migrations/runner.js";
import { SQLiteChatRepository } from "@arc/db/repositories/SQLiteChatRepository.js";
import { SQLiteMessageRepository } from "@arc/db/repositories/SQLiteMessageRepository.js";
import { FetchHTTP } from "@arc/platform-browser/http/FetchHTTP.js";
import { useChatStore } from "../chat-store";
import { webAttachmentsToCore } from "../utils/attachment-converter";

function mapChatToStore(chat: CoreChat) {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    lastMessageAt: chat.lastMessageAt,
  };
}

function mapMessageToStore(message: CoreMessage) {
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

export class LiveChatAPI implements IChatAPI {
  private db: IPlatformDatabase | null = null;
  private initialization: Promise<void> | null = null;
  private chatService: ChatService | null = null;
  private adapters: Map<string, OpenAIProvider | AnthropicProvider | GeminiProvider> = new Map();  // Map provider type to provider
  private providerRouter: ProviderRouter | null = null;
  private activeStreamMessageId: string | null = null;

  /**
   * Allow callers (e.g., provider) to eagerly initialise the database.
   */
  async ready(): Promise<void> {
    await this.ensureInitialized();
  }

  // ============================================================================
  // Chat Operations
  // ============================================================================

  async createChat(title?: string): Promise<string> {
    const chatService = await this.getChatService();
    const chatId = await chatService.createChat(title);

    const chats = await chatService.getChats();
    useChatStore.setState({
      chats: chats.map(mapChatToStore),
      activeChatId: chatId,
    });

    return chatId;
  }

  async selectChat(chatId: string): Promise<void> {
    const chatService = await this.getChatService();

    if (this.activeStreamMessageId) {
      await chatService.stopStreaming(this.activeStreamMessageId);
      this.activeStreamMessageId = null;
    }

    const messages = await chatService.getMessages(chatId);
    useChatStore.setState({
      activeChatId: chatId,
      messages: messages.map(mapMessageToStore),
      streamingChatId: null,
    });
  }

  async renameChat(chatId: string, title: string): Promise<void> {
    const chatService = await this.getChatService();
    await chatService.renameChat(chatId, title);

    const chats = await chatService.getChats();
    useChatStore.setState({
      chats: chats.map(mapChatToStore),
    });
  }

  async deleteChat(chatId: string): Promise<void> {
    const chatService = await this.getChatService();
    await chatService.deleteChat(chatId);

    const chats = await chatService.getChats();
    const { activeChatId } = useChatStore.getState();

    useChatStore.setState((state) => ({
      chats: chats.map(mapChatToStore),
      messages: chatId === activeChatId ? [] : state.messages,
      activeChatId:
        chatId === activeChatId ? (chats[0]?.id ?? null) : activeChatId,
      streamingChatId: chatId === state.streamingChatId ? null : state.streamingChatId,
    }));
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async sendMessage(
    chatId: string,
    content: string,
    model: string,
    attachments?: ImageAttachment[]
  ): Promise<void> {
    const chatService = await this.getChatService();

    const currentActiveChatId = useChatStore.getState().activeChatId;
    if (currentActiveChatId !== chatId) {
      await this.selectChat(chatId);
    }

    const coreAttachments = attachments
      ? await webAttachmentsToCore(attachments)
      : undefined;

    useChatStore.setState({ streamingChatId: chatId, lastError: null });

    try {
      const stream = chatService.sendMessage(
        chatId,
        content,
        coreAttachments,
        model
      );

      for await (const update of stream) {
        this.activeStreamMessageId = update.messageId;

        const messages = await chatService.getMessages(chatId);
        useChatStore.setState({
          messages: messages.map(mapMessageToStore),
        });
      }

      this.activeStreamMessageId = null;
      useChatStore.setState({ streamingChatId: null });

      const chats = await chatService.getChats();
      useChatStore.setState({
        chats: chats.map(mapChatToStore),
      });
    } catch (error) {
      this.activeStreamMessageId = null;
      useChatStore.setState({ streamingChatId: null });

      if (error instanceof ProviderError) {
        useChatStore.getState().setError({
          code: error.code,
          message: error.message,
          userMessage: error.getUserMessage(),
          isRetryable: error.isRetryable,
        });
      } else {
        console.error("LiveChatAPI: Error sending message:", error);
        useChatStore.getState().setError({
          code: "unknown_error",
          message: error instanceof Error ? error.message : "Unknown error",
          userMessage: "An unexpected error occurred. Please try again.",
          isRetryable: true,
        });
      }

      throw error;
    }
  }

  async stopStreaming(chatId: string): Promise<void> {
    const chatService = await this.getChatService();
    if (this.activeStreamMessageId) {
      await chatService.stopStreaming(this.activeStreamMessageId);
      this.activeStreamMessageId = null;

      const messages = await chatService.getMessages(chatId);
      useChatStore.setState({
        messages: messages.map(mapMessageToStore),
        streamingChatId: null,
      });
    }
  }

  async regenerateMessage(messageId: string): Promise<void> {
    const chatService = await this.getChatService();
    const { activeChatId } = useChatStore.getState();
    if (!activeChatId) {
      throw new Error("No active chat");
    }

    useChatStore.setState({ streamingChatId: activeChatId });

    try {
      const stream = chatService.regenerateMessage(messageId);

      for await (const update of stream) {
        this.activeStreamMessageId = update.messageId;

        const messages = await chatService.getMessages(activeChatId);
        useChatStore.setState({
          messages: messages.map(mapMessageToStore),
        });
      }

      this.activeStreamMessageId = null;
      useChatStore.setState({ streamingChatId: null });
    } catch (error) {
      console.error("LiveChatAPI: Error regenerating message:", error);
      this.activeStreamMessageId = null;
      useChatStore.setState({ streamingChatId: null });
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    const chatService = await this.getChatService();
    const { activeChatId } = useChatStore.getState();
    if (!activeChatId) return;

    await chatService.deleteMessage(messageId);

    const messages = await chatService.getMessages(activeChatId);
    useChatStore.setState({
      messages: messages.map(mapMessageToStore),
    });
  }

  // ============================================================================
  // Provider Operations
  // ============================================================================

  async getAvailableModels(): Promise<ModelInfo[]> {
    await this.ensureInitialized();

    const { providerConfigs } = useChatStore.getState();
    const models: ModelInfo[] = [];

    // Fetch models from all providers
    for (const config of providerConfigs) {
      const adapter = this.adapters.get(config.provider);
      if (!adapter) {
        continue;
      }

      try {
        const providerModels = await adapter.listModels();

        // Convert to ModelInfo format and add to the list
        for (const model of providerModels) {
          models.push({
            id: model.id,
            name: model.id,  // For OpenAI, we use the ID as the name
            provider: config.provider,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch models from ${config.provider}:`, error);
      }
    }

    // Update the provider router with the model-to-provider mapping
    if (this.providerRouter) {
      this.providerRouter.updateModelMapping(models);
    }

    return models;
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  async search(query: string, chatId?: string): Promise<SearchResult[]> {
    const chatService = await this.getChatService();
    return chatService.searchMessages(query, chatId);
  }

  // ============================================================================
  // Internal helpers
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initialize();
    }
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    // Dynamically load SqlJsDatabase only in the browser to avoid SSR issues
    if (typeof window === "undefined") {
      throw new Error("LiveChatAPI can only be initialized in the browser");
    }

    const { SqlJsDatabase } = await import("@arc/platform-browser/database/SqlJsDatabase.js");
    this.db = new SqlJsDatabase();
    await this.db.init();
    await runMigrations(this.db);

    const { providerConfigs } = useChatStore.getState();

    if (!providerConfigs || providerConfigs.length === 0) {
      throw new Error("No providers configured");
    }

    const http = new FetchHTTP();

    // Create providers for all configured providers
    for (const config of providerConfigs) {
      if (config.provider === "openai") {
        const provider = new OpenAIProvider(
          http,
          config.apiKey || "",
          config.baseUrl
        );
        this.adapters.set(config.provider, provider);
      } else if (config.provider === "anthropic") {
        const provider = new AnthropicProvider(
          http,
          config.apiKey || "",
          {
            ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
            defaultMaxTokens: 4096,
          }
        );
        this.adapters.set(config.provider, provider);
      } else if (config.provider === "google") {
        const provider = new GeminiProvider(
          http,
          config.apiKey || "",
          {
            ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
          }
        );
        this.adapters.set(config.provider, provider);
      } else {
        console.warn(`Provider ${config.provider} is not yet supported`);
      }
    }

    if (this.adapters.size === 0) {
      throw new Error("No supported providers configured");
    }

    const chatRepo = new SQLiteChatRepository(this.db);
    const messageRepo = new SQLiteMessageRepository(this.db);

    // Create a provider router that can route to any configured provider
    const primaryConfig = providerConfigs[0];
    this.providerRouter = new ProviderRouter(
      this.adapters,
      primaryConfig!.provider
    );

    this.chatService = new ChatService(
      chatRepo,
      messageRepo,
      this.providerRouter,
      primaryConfig?.defaultModel || "gpt-4-turbo-preview",
      (fn) => this.db!.transaction(fn)
    );

    await this.hydrateStoreFromDatabase();
  }

  private async hydrateStoreFromDatabase(): Promise<void> {
    if (!this.chatService) {
      return;
    }

    const chats = await this.chatService.getChats();
    const chatSummaries = chats.map(mapChatToStore);

    const state = useChatStore.getState();
    let activeChatId = state.activeChatId;

    if (activeChatId && !chatSummaries.some((chat) => chat.id === activeChatId)) {
      activeChatId = null;
    }

    if (!activeChatId && chatSummaries.length > 0) {
      activeChatId = chatSummaries[0]!.id;
    }

    let messagesState = state.messages;
    if (activeChatId) {
      const messages = await this.chatService.getMessages(activeChatId);
      messagesState = messages.map(mapMessageToStore);
    } else {
      messagesState = [];
    }

    useChatStore.setState({
      chats: chatSummaries,
      activeChatId,
      messages: messagesState,
      streamingChatId: null,
    });
  }

  private async getChatService(): Promise<ChatService> {
    await this.ensureInitialized();
    if (!this.chatService) {
      throw new Error("ChatService not initialised");
    }
    return this.chatService;
  }
}
