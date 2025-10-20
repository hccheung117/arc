import type { Message } from "../domain/Message.js";

/**
 * Repository interface for Message entities
 *
 * Defines the contract for persisting and querying messages.
 * Implementations may use in-memory storage, SQLite, or other backends.
 */
export interface IMessageRepository {
  /**
   * Create a new message
   */
  create(message: Message): Promise<Message>;

  /**
   * Find a message by its ID
   * @returns The message if found, null otherwise
   */
  findById(id: string): Promise<Message | null>;

  /**
   * Find all messages for a given chat, sorted by createdAt ascending
   */
  findByChatId(chatId: string): Promise<Message[]>;

  /**
   * Find all messages across all chats
   */
  findAll(): Promise<Message[]>;

  /**
   * Update an existing message
   * @throws Error if message with given ID doesn't exist
   */
  update(message: Message): Promise<Message>;

  /**
   * Delete a message by its ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Delete all messages for a given chat
   * @returns Number of messages deleted
   */
  deleteByChatId(chatId: string): Promise<number>;

  /**
   * Search messages by content
   * @param query Search query string (case-insensitive partial match)
   * @param chatId Optional chat ID to scope the search to a specific chat
   * @returns Messages matching the query, sorted by createdAt descending (newest first)
   */
  search(query: string, chatId?: string): Promise<Message[]>;
}
