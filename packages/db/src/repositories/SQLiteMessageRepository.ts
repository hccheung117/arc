import type {
  ImageAttachment,
  IMessageRepository,
  IPlatformDatabase,
  Message,
} from "@arc/core";

type MessageRow = {
  id: string;
  chat_id: string;
  role: Message["role"];
  content: string;
  status: Message["status"];
  created_at: number;
  updated_at: number;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  data: string;
  mime_type: string;
  size: number;
  name: string | null;
  created_at: number;
};

export class SQLiteMessageRepository implements IMessageRepository {
  constructor(private readonly db: IPlatformDatabase) {}

  async create(message: Message): Promise<Message> {
    await this.db.exec(
      `INSERT INTO messages (id, chat_id, role, content, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.chatId,
        message.role,
        message.content,
        message.status,
        message.createdAt,
        message.updatedAt,
      ]
    );

    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        await this.createAttachment(message.id, attachment);
      }
    }

    return message;
  }

  async findById(id: string): Promise<Message | null> {
    const result = await this.db.query<MessageRow>(
      "SELECT * FROM messages WHERE id = ?",
      [id]
    );
    if (result.rows.length === 0) {
      return null;
    }
    const attachments = await this.findAttachmentsByMessageId(id);
    return this.rowToMessage(result.rows[0]!, attachments);
  }

  async findByChatId(chatId: string): Promise<Message[]> {
    const result = await this.db.query<MessageRow>(
      "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
      [chatId]
    );

    const messages = await Promise.all(
      result.rows.map(async (row) => {
        const attachments = await this.findAttachmentsByMessageId(row.id);
        return this.rowToMessage(row, attachments);
      })
    );

    return messages;
  }

  async findAll(): Promise<Message[]> {
    const result = await this.db.query<MessageRow>(
      "SELECT * FROM messages ORDER BY created_at ASC"
    );

    const messages = await Promise.all(
      result.rows.map(async (row) => {
        const attachments = await this.findAttachmentsByMessageId(row.id);
        return this.rowToMessage(row, attachments);
      })
    );

    return messages;
  }

  async update(message: Message): Promise<Message> {
    await this.db.exec(
      `UPDATE messages
       SET content = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [message.content, message.status, message.updatedAt, message.id]
    );
    return message;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.exec("DELETE FROM messages WHERE id = ?", [
      id,
    ]);
    return result.rowsAffected > 0;
  }

  async deleteByChatId(chatId: string): Promise<number> {
    const result = await this.db.exec(
      "DELETE FROM messages WHERE chat_id = ?",
      [chatId]
    );
    return result.rowsAffected;
  }

  private async createAttachment(
    messageId: string,
    attachment: ImageAttachment
  ): Promise<void> {
    await this.db.exec(
      `INSERT INTO attachments (id, message_id, data, mime_type, size, name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        attachment.id,
        messageId,
        attachment.data,
        attachment.mimeType,
        attachment.size,
        attachment.name ?? null,
        Date.now(),
      ]
    );
  }

  private async findAttachmentsByMessageId(
    messageId: string
  ): Promise<ImageAttachment[]> {
    const result = await this.db.query<AttachmentRow>(
      "SELECT * FROM attachments WHERE message_id = ? ORDER BY created_at ASC",
      [messageId]
    );

    return result.rows.map((row) => this.rowToAttachment(row));
  }

  private rowToMessage(
    row: MessageRow,
    attachments: ImageAttachment[]
  ): Message {
    const message: Message = {
      id: row.id,
      chatId: row.chat_id,
      role: row.role,
      content: row.content,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (attachments.length > 0) {
      message.attachments = attachments;
    }

    return message;
  }

  private rowToAttachment(row: AttachmentRow): ImageAttachment {
    const attachment: ImageAttachment = {
      id: row.id,
      data: row.data,
      mimeType: row.mime_type,
      size: row.size,
    };

    if (row.name !== null) {
      attachment.name = row.name;
    }

    return attachment;
  }
}
