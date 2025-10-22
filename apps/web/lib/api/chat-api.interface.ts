/**
 * IChatAPI - Interface defining all chat operations
 *
 * This interface serves as the contract between the UI layer and the data layer,
 * enabling runtime swapping between Mock (Zustand-based) and Live (HTTP-based)
 * implementations without changing UI code.
 */

import type { ImageAttachment } from "../types";
import type { SearchResult } from "@arc/core/services/ChatService.js";

/**
 * Model information for display in UI
 */
export interface ModelInfo {
  id: string;          // Model ID (e.g., "gpt-4-turbo-preview")
  name: string;        // Display name (e.g., "GPT-4 Turbo")
  provider: string;    // Provider type (e.g., "openai", "anthropic")
}

export interface IChatAPI {
  /**
   * Initialize the API and ensure it's ready to use
   * Optional method for implementations that require async setup
   */
  ready?(): Promise<void>;

  // ============================================================================
  // Chat Operations
  // ============================================================================

  /**
   * Create a new chat
   * @param title Optional title for the chat (auto-generated if not provided)
   * @returns Promise resolving to the new chat's ID
   */
  createChat(title?: string): Promise<string>;

  /**
   * Select/activate a chat
   * @param chatId ID of the chat to select
   */
  selectChat(chatId: string): Promise<void>;

  /**
   * Rename an existing chat
   * @param chatId ID of the chat to rename
   * @param title New title for the chat
   */
  renameChat(chatId: string, title: string): Promise<void>;

  /**
   * Delete a chat and all its messages
   * @param chatId ID of the chat to delete
   */
  deleteChat(chatId: string): Promise<void>;

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * Send a message in a chat
   * @param chatId ID of the chat to send the message to
   * @param content Text content of the message
   * @param model Model to use for generating the response
   * @param attachments Optional image attachments
   */
  sendMessage(
    chatId: string,
    content: string,
    model: string,
    attachments?: ImageAttachment[]
  ): Promise<void>;

  /**
   * Stop the current streaming response
   * @param chatId ID of the chat with active streaming
   */
  stopStreaming(chatId: string): Promise<void>;

  /**
   * Regenerate an assistant message
   * @param messageId ID of the assistant message to regenerate
   */
  regenerateMessage(messageId: string): Promise<void>;

  /**
   * Delete a specific message
   * @param messageId ID of the message to delete
   */
  deleteMessage(messageId: string): Promise<void>;

  // ============================================================================
  // Provider Operations
  // ============================================================================

  /**
   * Get all available models from all enabled providers
   * @returns Promise resolving to array of available models
   */
  getAvailableModels(): Promise<ModelInfo[]>;

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search across all chats and messages
   * @param query Search query string
   * @param chatId Optional chat ID to scope search to a specific chat
   * @returns Promise resolving to array of search results with chat context
   */
  search(query: string, chatId?: string): Promise<SearchResult[]>;
}
