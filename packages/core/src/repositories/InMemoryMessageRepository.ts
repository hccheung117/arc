import type { Message } from "../domain/Message.js";
import type { IMessageRepository } from "./IMessageRepository.js";

/**
 * In-memory implementation of IMessageRepository
 *
 * Stores messages in a Map for fast lookups.
 * Suitable for development, testing, and single-session usage.
 */
export class InMemoryMessageRepository implements IMessageRepository {
  private messages = new Map<string, Message>();

  async create(message: Message): Promise<Message> {
    if (this.messages.has(message.id)) {
      throw new Error(`Message with id ${message.id} already exists`);
    }
    this.messages.set(message.id, { ...message });
    return message;
  }

  async findById(id: string): Promise<Message | null> {
    const message = this.messages.get(id);
    return message ? { ...message } : null;
  }

  async findByChatId(chatId: string): Promise<Message[]> {
    // Return messages for this chat sorted by createdAt ascending (oldest first)
    return Array.from(this.messages.values())
      .filter((msg) => msg.chatId === chatId)
      .map((msg) => ({ ...msg }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async findAll(): Promise<Message[]> {
    return Array.from(this.messages.values()).map((msg) => ({ ...msg }));
  }

  async update(message: Message): Promise<Message> {
    if (!this.messages.has(message.id)) {
      throw new Error(`Message with id ${message.id} not found`);
    }
    this.messages.set(message.id, { ...message });
    return message;
  }

  async delete(id: string): Promise<boolean> {
    return this.messages.delete(id);
  }

  async deleteByChatId(chatId: string): Promise<number> {
    let count = 0;
    for (const [id, message] of this.messages.entries()) {
      if (message.chatId === chatId) {
        this.messages.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all messages (useful for testing)
   */
  clear(): void {
    this.messages.clear();
  }

  /**
   * Get count of messages (useful for testing)
   */
  count(): number {
    return this.messages.size;
  }
}
