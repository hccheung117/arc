import type { Chat } from "./chat.js";
import type { ChatRepository } from "./chat-repository.type.js";
import type { PlatformDatabase } from "@arc/platform";
import type { Chat as ChatRow } from "@arc/db/schema.js";

/**
 * SQLite implementation of ChatRepository
 *
 * Persists chats to the SQLite database using the platform database driver.
 */
export class SQLiteChatRepository implements ChatRepository {
  private db: PlatformDatabase;

  constructor(db: PlatformDatabase) {
    this.db = db;
  }

  async create(chat: Chat): Promise<Chat> {
    await this.db.exec(
      `INSERT INTO chats (id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [chat.id, chat.title, chat.createdAt, chat.updatedAt]
    );

    return chat;
  }

  async findById(id: string): Promise<Chat | null> {
    const result = await this.db.query<ChatRow & Record<string, unknown>>(
      `SELECT * FROM chats WHERE id = ?`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toChat(result.rows[0]!);
  }

  async findAll(): Promise<Chat[]> {
    const result = await this.db.query<ChatRow & Record<string, unknown>>(
      `SELECT c.*, MAX(m.created_at) as last_message_at
       FROM chats c
       LEFT JOIN messages m ON c.id = m.chat_id
       GROUP BY c.id
       ORDER BY COALESCE(last_message_at, c.created_at) DESC`
    );

    return result.rows.map((row) => this.toChat(row));
  }

  async update(chat: Chat): Promise<Chat> {
    const result = await this.db.exec(
      `UPDATE chats
       SET title = ?, updated_at = ?
       WHERE id = ?`,
      [chat.title, chat.updatedAt, chat.id]
    );

    if (result.rowsAffected === 0) {
      throw new Error(`Chat with id ${chat.id} not found`);
    }

    return chat;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.exec(
      `DELETE FROM chats WHERE id = ?`,
      [id]
    );

    return result.rowsAffected > 0;
  }

  async search(query: string): Promise<Chat[]> {
    if (!query.trim()) {
      return [];
    }

    const result = await this.db.query<ChatRow & Record<string, unknown>>(
      `SELECT c.*, MAX(m.created_at) as last_message_at
       FROM chats c
       LEFT JOIN messages m ON c.id = m.chat_id
       WHERE c.title LIKE ?
       GROUP BY c.id
       ORDER BY COALESCE(last_message_at, c.created_at) DESC`,
      [`%${query}%`]
    );

    return result.rows.map((row) => this.toChat(row));
  }

  /**
   * Convert database row to Chat domain object
   */
  private toChat(row: ChatRow & { last_message_at?: number }): Chat {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at ?? row.created_at,
    };
  }
}
