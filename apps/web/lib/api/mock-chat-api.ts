/**
 * MockChatAPI - Implementation wrapping the existing Zustand store
 *
 * This implementation delegates all operations to the existing chat-store.ts
 * Zustand store, maintaining identical behavior to the current implementation.
 * It serves as the default/"local" mode for development and offline usage.
 */

import type { IChatAPI } from "./chat-api.interface";
import type { ImageAttachment } from "../types";
import type { SearchResult } from "@arc/core";
import { useChatStore } from "../chat-store";

export class MockChatAPI implements IChatAPI {
  // ============================================================================
  // Chat Operations
  // ============================================================================

  async createChat(title?: string): Promise<string> {
    const chatId = useChatStore.getState().createChat(title);
    return chatId;
  }

  async selectChat(chatId: string): Promise<void> {
    useChatStore.getState().selectChat(chatId);
  }

  async renameChat(chatId: string, title: string): Promise<void> {
    useChatStore.getState().renameChat(chatId, title);
  }

  async deleteChat(chatId: string): Promise<void> {
    useChatStore.getState().deleteChat(chatId);
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async sendMessage(
    chatId: string,
    content: string,
    attachments?: ImageAttachment[]
  ): Promise<void> {
    // The store's sendMessage operates on the active chat, so ensure it's selected
    const currentActiveChatId = useChatStore.getState().activeChatId;

    if (currentActiveChatId !== chatId) {
      // If the target chat is not active, select it first
      await this.selectChat(chatId);
    }

    useChatStore.getState().sendMessage(content, attachments);
  }

  async stopStreaming(chatId: string): Promise<void> {
    // Verify this is the currently streaming chat
    const streamingChatId = useChatStore.getState().streamingChatId;

    if (streamingChatId === chatId) {
      useChatStore.getState().stopStreaming();
    } else {
      console.warn(`MockChatAPI: Cannot stop streaming - chat ${chatId} is not currently streaming`);
    }
  }

  async regenerateMessage(messageId: string): Promise<void> {
    useChatStore.getState().regenerateMessage(messageId);
  }

  async deleteMessage(messageId: string): Promise<void> {
    useChatStore.getState().deleteMessage(messageId);
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  async search(query: string, chatId?: string): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const state = useChatStore.getState();
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Create chat title lookup map
    const chatTitleMap = new Map(state.chats.map(chat => [chat.id, chat.title]));

    // Search through all messages
    for (const message of state.messages) {
      // Skip if chatId is specified and doesn't match
      if (chatId && message.chatId !== chatId) {
        continue;
      }

      // Search in message content
      if (message.content.toLowerCase().includes(lowerQuery)) {
        const chatTitle = chatTitleMap.get(message.chatId) || "Unknown Chat";
        // The mock store uses web ImageAttachment, not core ImageAttachment
        // So we return a compatible structure without attachments
        const coreMessage = {
          id: message.id,
          chatId: message.chatId,
          role: message.role,
          content: message.content,
          status: message.status,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        };
        results.push({
          message: coreMessage,
          chatTitle,
        });
      }
    }

    // Sort by createdAt descending (newest first)
    results.sort((a, b) => b.message.createdAt - a.message.createdAt);

    return results;
  }

  // ============================================================================
  // Development/Testing Utilities
  // ============================================================================

  async seedDemoChats(): Promise<void> {
    useChatStore.getState().seedDemoChats();
  }
}
