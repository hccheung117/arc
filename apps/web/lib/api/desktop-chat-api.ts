/**
 * DesktopChatAPI - Desktop implementation with file-backed SQLite and file system attachments
 *
 * Uses better-sqlite3 via @arc/platform-electron and stores attachments as files
 * in the user data directory. Data persists natively on disk.
 */

import type { IChatAPI, ModelInfo } from "./chat-api.interface";
import type { ImageAttachment } from "../types";
import type { ProviderConfig } from "../chat-store";
import { ChatService, type SearchResult } from "@arc/core/services/ChatService.js";
import { OpenAIAdapter } from "@arc/ai/openai/OpenAIAdapter.js";
import { ProviderError } from "@arc/core/domain/ProviderError.js";
import type { Chat as CoreChat } from "@arc/core/domain/Chat.js";
import type { Message as CoreMessage } from "@arc/core/domain/Message.js";
import type { IPlatformDatabase } from "@arc/core/platform/IPlatformDatabase.js";
import type { IPlatformFileSystem } from "@arc/core/platform/IPlatformFileSystem.js";
import { runMigrations } from "@arc/db/migrations/runner.js";
import { SQLiteChatRepository } from "@arc/db/repositories/SQLiteChatRepository.js";
import { SQLiteMessageRepository } from "@arc/db/repositories/SQLiteMessageRepository.js";
import { useChatStore } from "../chat-store";
import { generateId } from "@arc/core/utils/id.js";

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

export class DesktopChatAPI implements IChatAPI {
  private db: IPlatformDatabase | null = null;
  private fs: IPlatformFileSystem | null = null;
  private initialization: Promise<void> | null = null;
  private chatService: ChatService | null = null;
  private adapters: Map<string, OpenAIAdapter> = new Map();  // Map provider type to adapter
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
    const fs = this.requireFileSystem();

    // Delete all attachments for this chat
    await fs.deleteAttachmentsForChat(chatId);

    await chatService.deleteChat(chatId);

    const chats = await chatService.getChats();
    const { activeChatId } = useChatStore.getState();

    useChatStore.setState((state) => ({
      chats: chats.map(mapChatToStore),
      messages: chatId === activeChatId ? [] : state.messages,
      activeChatId:
        chatId === activeChatId ? (chats[0]?.id ?? null) : activeChatId,
      streamingChatId:
        chatId === state.streamingChatId ? null : state.streamingChatId,
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
    const fs = this.requireFileSystem();

    const currentActiveChatId = useChatStore.getState().activeChatId;
    if (currentActiveChatId !== chatId) {
      await this.selectChat(chatId);
    }

    // Convert web attachments to core format with file system storage
    const coreAttachments = attachments
      ? await Promise.all(
          attachments.map(async (webAttachment) => {
            const attachmentId = generateId();

            // Read file as base64 data URL
            const dataUrl = await this.fileToDataUrl(webAttachment.file);

            // Save attachment to file system
            const storagePath = await fs.saveAttachment(
              attachmentId,
              chatId,
              webAttachment.file.name,
              webAttachment.type,
              dataUrl
            );

            // Return core attachment with file path instead of data
            return {
              id: attachmentId,
              data: dataUrl, // Still needed for sending to AI
              mimeType: webAttachment.type,
              size: webAttachment.size,
              name: webAttachment.file.name,
              storagePath, // Additional field for desktop (not in core interface yet)
            };
          })
        )
      : undefined;

    useChatStore.setState({ streamingChatId: chatId, lastError: null });

    try {
      const stream = chatService.sendMessage(chatId, content, coreAttachments, model);

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
        console.error("DesktopChatAPI: Error sending message:", error);
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
      console.error("DesktopChatAPI: Error regenerating message:", error);
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

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file as data URL"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initialize();
    }
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    // Dynamically load platform-electron packages (safe - no SSR issues)
    if (typeof window === "undefined") {
      throw new Error("DesktopChatAPI can only be initialized in the browser");
    }

    // Dynamic imports (only available in Electron)
    // @ts-expect-error - Platform-desktop is only available in Electron context
    const { BetterSqlite3Database } = await import("@arc/platform-electron/database/BetterSqlite3Database.js");
    // @ts-expect-error - Platform-desktop is only available in Electron context
    const { NodeFetchHTTP } = await import("@arc/platform-electron/http/NodeFetchHTTP.js");
    // @ts-expect-error - Platform-desktop is only available in Electron context
    const { ElectronFileSystem } = await import("@arc/platform-electron/filesystem/ElectronFileSystem.js");

    // Get user data path from Electron
    const userDataPath = await this.getUserDataPath();

    // Initialize database with file path
    this.db = new BetterSqlite3Database({
      filePath: `${userDataPath}/arc.sqlite`,
      enableWAL: true,
    });
    await this.db!.init();
    await runMigrations(this.db!);

    // Initialize file system
    this.fs = new ElectronFileSystem();

    // Initialize adapters for all enabled providers
    const { providerConfigs } = useChatStore.getState();

    if (!providerConfigs || providerConfigs.length === 0) {
      throw new Error("No providers configured");
    }

    const http = new NodeFetchHTTP();

    // Create adapters for all providers
    for (const config of providerConfigs) {
      // For now, only OpenAI is supported, but this allows for future expansion
      if (config.provider === "openai") {
        const adapter = new OpenAIAdapter(
          http,
          config.apiKey || "",  // Some proxies don't need an API key
          config.baseUrl
        );
        this.adapters.set(config.provider, adapter);
      } else {
        console.warn(`Provider ${config.provider} is not yet supported`);
      }
    }

    if (this.adapters.size === 0) {
      throw new Error("No supported providers configured");
    }

    // Initialize repositories
    const chatRepo = new SQLiteChatRepository(this.db!);
    const messageRepo = new SQLiteMessageRepository(this.db!);

    // Use the first provider's adapter as the primary adapter for ChatService
    // The model can be overridden per message via sendMessage
    const primaryAdapter = Array.from(this.adapters.values())[0]!;
    const primaryConfig = providerConfigs[0];

    // Initialize chat service
    this.chatService = new ChatService(
      chatRepo,
      messageRepo,
      primaryAdapter,
      primaryConfig?.defaultModel || "gpt-4-turbo-preview",
      (fn) => this.db!.transaction(fn)
    );

    await this.hydrateStoreFromDatabase();
  }

  private async getUserDataPath(): Promise<string> {
    // Access Electron API through window.electron
    if (!window.electron || !window.electron.app) {
      throw new Error("Electron API not available");
    }

    return await window.electron.app.getUserDataPath();
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

  private requireFileSystem(): IPlatformFileSystem {
    if (!this.fs) {
      throw new Error("FileSystem not initialised");
    }
    return this.fs;
  }
}
