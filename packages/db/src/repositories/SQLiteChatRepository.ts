import type { Chat, IChatRepository, IPlatformDatabase } from "@arc/core";

type ChatRow = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  last_message_at: number;
};

export class SQLiteChatRepository implements IChatRepository {
  constructor(private readonly db: IPlatformDatabase) {}

  async create(chat: Chat): Promise<Chat> {
    await this.db.exec(
      `INSERT INTO chats (id, title, created_at, updated_at, last_message_at)
       VALUES (?, ?, ?, ?, ?)`,
      [chat.id, chat.title, chat.createdAt, chat.updatedAt, chat.lastMessageAt]
    );
    return chat;
  }

  async findById(id: string): Promise<Chat | null> {
    const result = await this.db.query<ChatRow>(
      "SELECT * FROM chats WHERE id = ?",
      [id]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.rowToChat(result.rows[0]!);
  }

  async findAll(): Promise<Chat[]> {
    const result = await this.db.query<ChatRow>(
      "SELECT * FROM chats ORDER BY last_message_at DESC"
    );
    return result.rows.map((row) => this.rowToChat(row));
  }

  async update(chat: Chat): Promise<Chat> {
    await this.db.exec(
      `UPDATE chats
       SET title = ?, updated_at = ?, last_message_at = ?
       WHERE id = ?`,
      [chat.title, chat.updatedAt, chat.lastMessageAt, chat.id]
    );
    return chat;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.exec("DELETE FROM chats WHERE id = ?", [id]);
    return result.rowsAffected > 0;
  }

  private rowToChat(row: ChatRow): Chat {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
    };
  }
}
