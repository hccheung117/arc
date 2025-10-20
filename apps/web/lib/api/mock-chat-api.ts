/**
 * MockChatAPI - Implementation wrapping the existing Zustand store
 *
 * This implementation delegates all operations to the existing chat-store.ts
 * Zustand store, maintaining identical behavior to the current implementation.
 * It serves as the default/"local" mode for development and offline usage.
 */

import type { IChatAPI } from "./chat-api.interface";
import type { ImageAttachment } from "../types";
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

  async search(_query: string): Promise<Array<{ chatId: string; messageId: string }>> {
    // Search is not yet implemented in the mock store
    // Return empty results for now
    console.warn("MockChatAPI: Search is not yet implemented");
    return [];
  }

  // ============================================================================
  // Development/Testing Utilities
  // ============================================================================

  async seedDemoChats(): Promise<void> {
    useChatStore.getState().seedDemoChats();
  }
}
