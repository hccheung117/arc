/**
 * LiveChatAPI - Stub implementation for HTTP-based backend
 *
 * This is a placeholder implementation that will eventually communicate with
 * a real backend server. For now, all methods return friendly "not implemented"
 * errors to allow UI testing without crashes.
 *
 * Future implementation will use HTTP requests to a backend API.
 */

import type { IChatAPI } from "./chat-api.interface";
import type { ImageAttachment } from "../types";

/**
 * Custom error class for unimplemented Live API methods
 */
export class NotImplementedError extends Error {
  constructor(operation: string) {
    super(`Live API: "${operation}" is not yet implemented. This feature is coming soon!`);
    this.name = "NotImplementedError";
  }
}

export class LiveChatAPI implements IChatAPI {
  // Base URL for the backend API (to be configured later)
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  // ============================================================================
  // Chat Operations
  // ============================================================================

  async createChat(_title?: string): Promise<string> {
    // Future: POST /api/chats
    throw new NotImplementedError("createChat");
  }

  async selectChat(_chatId: string): Promise<void> {
    // Future: This might be client-side only, or trigger a "mark as read" API call
    throw new NotImplementedError("selectChat");
  }

  async renameChat(_chatId: string, _title: string): Promise<void> {
    // Future: PATCH /api/chats/:chatId
    throw new NotImplementedError("renameChat");
  }

  async deleteChat(_chatId: string): Promise<void> {
    // Future: DELETE /api/chats/:chatId
    throw new NotImplementedError("deleteChat");
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async sendMessage(
    _chatId: string,
    _content: string,
    _attachments?: ImageAttachment[]
  ): Promise<void> {
    // Future: POST /api/chats/:chatId/messages
    // Will support streaming via Server-Sent Events (SSE) or WebSocket
    throw new NotImplementedError("sendMessage");
  }

  async stopStreaming(_chatId: string): Promise<void> {
    // Future: POST /api/chats/:chatId/stop
    throw new NotImplementedError("stopStreaming");
  }

  async regenerateMessage(_messageId: string): Promise<void> {
    // Future: POST /api/messages/:messageId/regenerate
    throw new NotImplementedError("regenerateMessage");
  }

  async deleteMessage(_messageId: string): Promise<void> {
    // Future: DELETE /api/messages/:messageId
    throw new NotImplementedError("deleteMessage");
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  async search(_query: string): Promise<Array<{ chatId: string; messageId: string }>> {
    // Future: GET /api/search?q={query}
    throw new NotImplementedError("search");
  }

  // ============================================================================
  // Development/Testing Utilities
  // ============================================================================

  async seedDemoChats(): Promise<void> {
    // Not applicable for live API (server would seed its own demo data)
    console.warn("LiveChatAPI: seedDemoChats is not supported in live mode");
  }
}
