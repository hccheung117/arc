import type { Chat } from "./chat.js";

/**
 * Repository interface for Chat entities
 *
 * Defines the contract for persisting and querying chats.
 * Implementations may use in-memory storage, SQLite, or other backends.
 */
export interface ChatRepository {
  /**
   * Create a new chat
   */
  create(chat: Chat): Promise<Chat>;

  /**
   * Find a chat by its ID
   * @returns The chat if found, null otherwise
   */
  findById(id: string): Promise<Chat | null>;

  /**
   * Find all chats, sorted by lastMessageAt descending
   */
  findAll(): Promise<Chat[]>;

  /**
   * Update an existing chat
   * @throws Error if chat with given ID doesn't exist
   */
  update(chat: Chat): Promise<Chat>;

  /**
   * Delete a chat by its ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Search chats by title
   * @param query - Search query string
   * @returns Chats with titles matching the query, sorted by relevance/date
   */
  search(query: string): Promise<Chat[]>;
}
