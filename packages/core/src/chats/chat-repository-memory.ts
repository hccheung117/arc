import type { Chat } from "./chat.js";
import type { IChatRepository } from "./chat-repository.type.js";

/**
 * In-memory implementation of IChatRepository
 *
 * Stores chats in a Map for fast lookups.
 * Suitable for development, testing, and single-session usage.
 */
export class InMemoryChatRepository implements IChatRepository {
  private chats = new Map<string, Chat>();

  async create(chat: Chat): Promise<Chat> {
    if (this.chats.has(chat.id)) {
      throw new Error(`Chat with id ${chat.id} already exists`);
    }
    this.chats.set(chat.id, { ...chat });
    return chat;
  }

  async findById(id: string): Promise<Chat | null> {
    const chat = this.chats.get(id);
    return chat ? { ...chat } : null;
  }

  async findAll(): Promise<Chat[]> {
    // Return chats sorted by lastMessageAt descending (most recent first)
    return Array.from(this.chats.values())
      .map((chat) => ({ ...chat }))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  async update(chat: Chat): Promise<Chat> {
    if (!this.chats.has(chat.id)) {
      throw new Error(`Chat with id ${chat.id} not found`);
    }
    this.chats.set(chat.id, { ...chat });
    return chat;
  }

  async delete(id: string): Promise<boolean> {
    return this.chats.delete(id);
  }

  async search(query: string): Promise<Chat[]> {
    if (!query.trim()) {
      return [];
    }

    const lowerQuery = query.toLowerCase();

    return Array.from(this.chats.values())
      .filter((chat) => chat.title.toLowerCase().includes(lowerQuery))
      .map((chat) => ({ ...chat }))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  /**
   * Clear all chats (useful for testing)
   */
  clear(): void {
    this.chats.clear();
  }

  /**
   * Get count of chats (useful for testing)
   */
  count(): number {
    return this.chats.size;
  }
}
