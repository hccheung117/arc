/**
 * LiveChatAPI - Core-backed implementation with real OpenAI integration
 *
 * This implementation uses the headless @arc/core package with OpenAI adapter
 * for real API calls. It integrates the platform layer (FetchHTTP) with the
 * Core's business logic.
 */

import type { IChatAPI } from "./chat-api.interface";
import type { ImageAttachment } from "../types";
import {
  ChatService,
  InMemoryChatRepository,
  InMemoryMessageRepository,
  OpenAIAdapter,
  ProviderError,
} from "@arc/core";
import { FetchHTTP } from "@arc/platform-web";
import { useChatStore } from "../chat-store";
import { webAttachmentsToCore } from "../utils/attachment-converter";

export class LiveChatAPI implements IChatAPI {
  private chatService: ChatService;
  private openAI: OpenAIAdapter;
  private activeStreamMessageId: string | null = null;

  constructor() {
    // Get provider settings from store
    const { providerSettings } = useChatStore.getState();

    // Initialize platform HTTP layer
    const http = new FetchHTTP();

    // Initialize OpenAI adapter
    this.openAI = new OpenAIAdapter(
      http,
      providerSettings.apiKey,
      providerSettings.baseUrl
    );

    // Initialize Core with in-memory repositories and OpenAI adapter
    const chatRepo = new InMemoryChatRepository();
    const messageRepo = new InMemoryMessageRepository();
    this.chatService = new ChatService(
      chatRepo,
      messageRepo,
      this.openAI,
      providerSettings.model
    );
  }

  // ============================================================================
  // Chat Operations
  // ============================================================================

  async createChat(title?: string): Promise<string> {
    const chatId = await this.chatService.createChat(title);

    // Sync with Zustand store
    const chats = await this.chatService.getChats();
    useChatStore.setState({
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        lastMessageAt: chat.lastMessageAt,
      })),
      activeChatId: chatId,
    });

    return chatId;
  }

  async selectChat(chatId: string): Promise<void> {
    // Stop any ongoing streaming when switching chats
    if (this.activeStreamMessageId) {
      await this.chatService.stopStreaming(this.activeStreamMessageId);
      this.activeStreamMessageId = null;
    }

    // Fetch messages for this chat
    const messages = await this.chatService.getMessages(chatId);

    // Update Zustand store
    useChatStore.setState({
      activeChatId: chatId,
      messages: messages.map((msg) => ({
        id: msg.id,
        chatId: msg.chatId,
        role: msg.role,
        content: msg.content,
        status: msg.status,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        // Note: attachments are in core format (base64), would need conversion for display
        // For now, we'll skip attachments as they're handled in Mock mode
      })),
      streamingChatId: null,
    });
  }

  async renameChat(chatId: string, title: string): Promise<void> {
    await this.chatService.renameChat(chatId, title);

    // Sync with Zustand store
    const chats = await this.chatService.getChats();
    useChatStore.setState({
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        lastMessageAt: chat.lastMessageAt,
      })),
    });
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.chatService.deleteChat(chatId);

    // Sync with Zustand store
    const chats = await this.chatService.getChats();
    const { activeChatId } = useChatStore.getState();

    useChatStore.setState({
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        lastMessageAt: chat.lastMessageAt,
      })),
      messages:
        chatId === activeChatId ? [] : useChatStore.getState().messages,
      activeChatId:
        chatId === activeChatId ? (chats[0]?.id ?? null) : activeChatId,
    });
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async sendMessage(
    chatId: string,
    content: string,
    attachments?: ImageAttachment[]
  ): Promise<void> {
    // Ensure this chat is active
    const currentActiveChatId = useChatStore.getState().activeChatId;
    if (currentActiveChatId !== chatId) {
      await this.selectChat(chatId);
    }

    // Convert web attachments to core format
    const coreAttachments = attachments
      ? await webAttachmentsToCore(attachments)
      : undefined;

    // Start streaming
    useChatStore.setState({ streamingChatId: chatId });

    try {
      const stream = this.chatService.sendMessage(
        chatId,
        content,
        coreAttachments
      );

      for await (const update of stream) {
        // Track the message being streamed
        this.activeStreamMessageId = update.messageId;

        // Fetch latest messages from Core and sync to Zustand
        const messages = await this.chatService.getMessages(chatId);
        useChatStore.setState({
          messages: messages.map((msg) => ({
            id: msg.id,
            chatId: msg.chatId,
            role: msg.role,
            content: msg.content,
            status: msg.status,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
          })),
        });
      }

      // Stream completed
      this.activeStreamMessageId = null;
      useChatStore.setState({ streamingChatId: null });

      // Update chat list (timestamps changed)
      const chats = await this.chatService.getChats();
      useChatStore.setState({
        chats: chats.map((chat) => ({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          lastMessageAt: chat.lastMessageAt,
        })),
      });
    } catch (error) {
      // Handle errors
      console.error("LiveChatAPI: Error sending message:", error);
      this.activeStreamMessageId = null;
      useChatStore.setState({ streamingChatId: null });
      throw error;
    }
  }

  async stopStreaming(chatId: string): Promise<void> {
    if (this.activeStreamMessageId) {
      await this.chatService.stopStreaming(this.activeStreamMessageId);
      this.activeStreamMessageId = null;

      // Sync messages
      const messages = await this.chatService.getMessages(chatId);
      useChatStore.setState({
        messages: messages.map((msg) => ({
          id: msg.id,
          chatId: msg.chatId,
          role: msg.role,
          content: msg.content,
          status: msg.status,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        })),
        streamingChatId: null,
      });
    }
  }

  async regenerateMessage(messageId: string): Promise<void> {
    const { activeChatId } = useChatStore.getState();
    if (!activeChatId) {
      throw new Error("No active chat");
    }

    useChatStore.setState({ streamingChatId: activeChatId });

    try {
      const stream = this.chatService.regenerateMessage(messageId);

      for await (const update of stream) {
        this.activeStreamMessageId = update.messageId;

        // Fetch latest messages and sync to Zustand
        const messages = await this.chatService.getMessages(activeChatId);
        useChatStore.setState({
          messages: messages.map((msg) => ({
            id: msg.id,
            chatId: msg.chatId,
            role: msg.role,
            content: msg.content,
            status: msg.status,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
          })),
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
    const { activeChatId } = useChatStore.getState();
    if (!activeChatId) return;

    await this.chatService.deleteMessage(messageId);

    // Sync messages
    const messages = await this.chatService.getMessages(activeChatId);
    useChatStore.setState({
      messages: messages.map((msg) => ({
        id: msg.id,
        chatId: msg.chatId,
        role: msg.role,
        content: msg.content,
        status: msg.status,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
    });
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  async search(_query: string): Promise<Array<{ chatId: string; messageId: string }>> {
    // Search is not yet implemented in Core
    console.warn("LiveChatAPI: Search is not yet implemented");
    return [];
  }

  // ============================================================================
  // Development/Testing Utilities
  // ============================================================================

  async seedDemoChats(): Promise<void> {
    // Create demo chats using Core
    const chat1Id = await this.chatService.createChat("Code Examples");
    const chat2Id = await this.chatService.createChat("Diagrams & Visualizations");
    const chat3Id = await this.chatService.createChat("Math & Formulas");

    // Send some demo messages (simplified - no full demo content for now)
    const stream1 = this.chatService.sendMessage(chat1Id, "Show me some code examples");
    for await (const _update of stream1) {
      // Consume stream
    }

    const stream2 = this.chatService.sendMessage(chat2Id, "Can you create diagrams?");
    for await (const _update of stream2) {
      // Consume stream
    }

    const stream3 = this.chatService.sendMessage(chat3Id, "Show me some math notation");
    for await (const _update of stream3) {
      // Consume stream
    }

    // Sync all chats and messages to Zustand
    const chats = await this.chatService.getChats();
    useChatStore.setState({
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        lastMessageAt: chat.lastMessageAt,
      })),
      activeChatId: chat1Id,
    });

    // Load messages for first chat
    await this.selectChat(chat1Id);
  }
}
