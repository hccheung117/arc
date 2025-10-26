import type { Message } from "./message.js";
import type { IMessageRepository } from "./message-repository.type.js";
import type { ImageAttachment } from "../shared/image-attachment.js";
import type { IPlatformDatabase } from "@arc/platform";
import type { Message as MessageRow, MessageAttachment } from "@arc/db/schema.js";

/**
 * SQLite implementation of IMessageRepository
 *
 * Persists messages to the SQLite database using the platform database driver.
 * Handles attachments as separate rows in the message_attachments table.
 */
export class SQLiteMessageRepository implements IMessageRepository {
  private db: IPlatformDatabase;

  constructor(db: IPlatformDatabase) {
    this.db = db;
  }

  async create(message: Message): Promise<Message> {
    await this.db.transaction(async () => {
      // Insert message
      await this.db.exec(
        `INSERT INTO messages (
          id, chat_id, role, content, model, provider_connection_id,
          token_count, parent_message_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.chatId,
          message.role,
          message.content,
          message.model ?? null,
          message.providerConnectionId ?? null,
          null, // token_count - not tracked yet
          null, // parent_message_id - not tracked yet
          message.status,
          message.createdAt,
          message.updatedAt,
        ]
      );

      // Insert attachments if any
      if (message.attachments && message.attachments.length > 0) {
        for (const attachment of message.attachments) {
          await this.db.exec(
            `INSERT INTO message_attachments (
              id, message_id, type, mime_type, data, name, size, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              attachment.id,
              message.id,
              "image",
              attachment.mimeType,
              attachment.data,
              attachment.name ?? null,
              attachment.size,
              Date.now(),
            ]
          );
        }
      }
    });

    return message;
  }

  async findById(id: string): Promise<Message | null> {
    const result = await this.db.query<MessageRow & Record<string, unknown>>(
      `SELECT * FROM messages WHERE id = ?`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toMessage(result.rows[0]!);
  }

  async findByChatId(chatId: string): Promise<Message[]> {
    const result = await this.db.query<MessageRow & Record<string, unknown>>(
      `SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC`,
      [chatId]
    );

    const messages: Message[] = [];
    for (const row of result.rows) {
      messages.push(await this.toMessage(row));
    }

    return messages;
  }

  async findAll(): Promise<Message[]> {
    const result = await this.db.query<MessageRow & Record<string, unknown>>(
      `SELECT * FROM messages ORDER BY created_at DESC`
    );

    const messages: Message[] = [];
    for (const row of result.rows) {
      messages.push(await this.toMessage(row));
    }

    return messages;
  }

  async update(message: Message): Promise<Message> {
    const result = await this.db.exec(
      `UPDATE messages
       SET content = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [message.content, message.status, message.updatedAt, message.id]
    );

    if (result.rowsAffected === 0) {
      throw new Error(`Message with id ${message.id} not found`);
    }

    // Note: We don't update attachments on message update
    // Attachments are immutable once created

    return message;
  }

  async delete(id: string): Promise<boolean> {
    // SQLite will cascade delete attachments via foreign key
    const result = await this.db.exec(`DELETE FROM messages WHERE id = ?`, [
      id,
    ]);

    return result.rowsAffected > 0;
  }

  async deleteByChatId(chatId: string): Promise<number> {
    // SQLite will cascade delete attachments via foreign key
    const result = await this.db.exec(
      `DELETE FROM messages WHERE chat_id = ?`,
      [chatId]
    );

    return result.rowsAffected;
  }

  async search(query: string, chatId?: string): Promise<Message[]> {
    let sql: string;
    let params: unknown[];

    if (chatId) {
      sql = `SELECT * FROM messages
             WHERE chat_id = ? AND content LIKE ?
             ORDER BY created_at DESC`;
      params = [chatId, `%${query}%`];
    } else {
      sql = `SELECT * FROM messages
             WHERE content LIKE ?
             ORDER BY created_at DESC`;
      params = [`%${query}%`];
    }

    const result = await this.db.query<MessageRow & Record<string, unknown>>(sql, params);

    const messages: Message[] = [];
    for (const row of result.rows) {
      messages.push(await this.toMessage(row));
    }

    return messages;
  }

  /**
   * Convert database row to Message domain object
   */
  private async toMessage(row: MessageRow): Promise<Message> {
    // Fetch attachments for this message
    const attachmentsResult = await this.db.query<MessageAttachment & Record<string, unknown>>(
      `SELECT * FROM message_attachments WHERE message_id = ?`,
      [row.id]
    );

    const attachments: ImageAttachment[] = attachmentsResult.rows.map((att) => {
      const img: ImageAttachment = {
        id: att.id,
        data: att.data,
        mimeType: att.mime_type,
        size: att.size ?? 0,
      };
      // Conditionally add name if present
      if (att.name !== null && att.name !== undefined) {
        img.name = att.name;
      }
      return img;
    });

    const message: Message = {
      id: row.id,
      chatId: row.chat_id,
      role: row.role,
      content: row.content,
      status: row.status as "pending" | "streaming" | "complete" | "error" | "stopped",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Conditionally add optional properties to satisfy exactOptionalPropertyTypes
    if (row.model !== null) {
      message.model = row.model;
    }
    if (row.provider_connection_id !== null) {
      message.providerConnectionId = row.provider_connection_id;
    }
    if (attachments.length > 0) {
      message.attachments = attachments;
    }

    return message;
  }
}
