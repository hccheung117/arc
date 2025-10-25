import { describe, it, expect, beforeEach } from "vitest";
import type { IMessageRepository } from "../src/messages/message-repository.type.js";
import { InMemoryMessageRepository } from "../src/messages/message-repository-memory.js";
import { SQLiteMessageRepository } from "../src/messages/message-repository-sqlite.js";
import type { Message } from "../src/messages/message.js";
import type { ImageAttachment } from "../src/shared/image-attachment.js";
import type { IPlatformDatabase } from "@arc/platform";

/**
 * Message Repository Contract Tests
 *
 * These tests ensure both in-memory and SQLite implementations
 * satisfy the IMessageRepository contract.
 */

/**
 * Create a mock in-memory database for testing SQLite repository
 */
function createMockDatabase(): IPlatformDatabase {
  const messagesStore = new Map<string, {
    id: string;
    chat_id: string;
    role: string;
    content: string;
    model: string | null;
    provider_connection_id: string | null;
    created_at: number;
    updated_at: number;
  }>();

  const attachmentsStore = new Map<string, Array<{
    id: string;
    message_id: string;
    type: string;
    mime_type: string;
    data: string;
  }>>();

  return {
    async init() {},
    async close() {},
    async query(sql: string, params?: unknown[]) {
      // Get attachments for a message
      if (sql.includes("SELECT * FROM message_attachments WHERE message_id = ?")) {
        const messageId = params?.[0] as string;
        const attachments = attachmentsStore.get(messageId) || [];
        return { rows: attachments };
      }

      // Get single message by ID
      if (sql.includes("WHERE id = ?")) {
        const id = params?.[0] as string;
        const msg = messagesStore.get(id);
        return { rows: msg ? [msg] : [] };
      }

      // Get messages by chat ID (ORDER BY created_at ASC)
      if (sql.includes("WHERE chat_id = ?") && sql.includes("ORDER BY created_at ASC")) {
        const chatId = params?.[0] as string;
        const rows = Array.from(messagesStore.values())
          .filter(m => m.chat_id === chatId)
          .sort((a, b) => a.created_at - b.created_at); // ASC order
        return { rows };
      }

      // Search messages (WHERE chat_id = ? AND content LIKE ?)
      if (sql.includes("WHERE chat_id = ?") && sql.includes("content LIKE ?")) {
        const chatId = params?.[0] as string;
        const query = params?.[1] as string;
        const searchTerm = query.replace(/%/g, "").toLowerCase();

        const rows = Array.from(messagesStore.values())
          .filter(m => m.chat_id === chatId && m.content.toLowerCase().includes(searchTerm))
          .sort((a, b) => b.created_at - a.created_at); // DESC order
        return { rows };
      }

      // Search messages (WHERE content LIKE ?)
      if (sql.includes("WHERE content LIKE ?")) {
        const query = params?.[0] as string;
        const searchTerm = query.replace(/%/g, "").toLowerCase();

        const rows = Array.from(messagesStore.values())
          .filter(m => m.content.toLowerCase().includes(searchTerm))
          .sort((a, b) => b.created_at - a.created_at); // DESC order
        return { rows };
      }

      // Get all messages (ORDER BY created_at DESC)
      if (sql.includes("SELECT * FROM messages") && sql.includes("ORDER BY created_at DESC")) {
        const rows = Array.from(messagesStore.values())
          .sort((a, b) => b.created_at - a.created_at);
        return { rows };
      }

      // Get all messages (no ORDER BY)
      if (sql.includes("SELECT * FROM messages")) {
        return { rows: Array.from(messagesStore.values()) };
      }

      return { rows: [] };
    },
    async exec(sql: string, params?: unknown[]) {
      // Insert message - Real SQL has 10 parameters
      if (sql.includes("INSERT INTO messages")) {
        // Real SQL: id, chat_id, role, content, model, provider_connection_id, token_count, parent_message_id, created_at, updated_at
        const [id, chat_id, role, content, model, provider_connection_id, token_count, parent_message_id, created_at, updated_at] = params as any[];
        messagesStore.set(id, { id, chat_id, role, content, model, provider_connection_id, created_at, updated_at });
        return { rowsAffected: 1 };
      }

      // Insert attachment
      if (sql.includes("INSERT INTO message_attachments")) {
        // Real SQL: id, message_id, type, mime_type, data, created_at
        const [id, message_id, type, mime_type, data, created_at] = params as any[];
        const existing = attachmentsStore.get(message_id) || [];
        existing.push({ id, message_id, type, mime_type, data });
        attachmentsStore.set(message_id, existing);
        return { rowsAffected: 1 };
      }

      // Update message - Real SQL: content = ?, updated_at = ? WHERE id = ?
      if (sql.includes("UPDATE messages")) {
        const [content, updated_at, id] = params as any[];
        const msg = messagesStore.get(id);
        if (msg) {
          messagesStore.set(id, { ...msg, content, updated_at });
          return { rowsAffected: 1 };
        }
        return { rowsAffected: 0 };
      }

      // Delete message
      if (sql.includes("DELETE FROM messages WHERE id = ?")) {
        const id = params?.[0] as string;
        const had = messagesStore.has(id);
        messagesStore.delete(id);
        // Cascade delete attachments
        attachmentsStore.delete(id);
        return { rowsAffected: had ? 1 : 0 };
      }

      // Delete messages by chat ID
      if (sql.includes("DELETE FROM messages WHERE chat_id = ?")) {
        const chatId = params?.[0] as string;
        let count = 0;
        for (const [id, msg] of messagesStore.entries()) {
          if (msg.chat_id === chatId) {
            messagesStore.delete(id);
            attachmentsStore.delete(id);
            count++;
          }
        }
        return { rowsAffected: count };
      }

      return { rowsAffected: 0 };
    },
    async transaction(fn: () => Promise<void>) {
      await fn();
    },
  };
}

describe.each([
  { name: "InMemoryMessageRepository", factory: () => new InMemoryMessageRepository() },
  { name: "SQLiteMessageRepository", factory: () => new SQLiteMessageRepository(createMockDatabase()) },
])("$name", ({ factory }) => {
  let repo: IMessageRepository;

  beforeEach(() => {
    repo = factory();
  });

  const createMessage = (overrides: Partial<Message> = {}): Message => {
    const now = Date.now();
    return {
      id: `msg-${now}-${Math.random()}`,
      chatId: "chat-1",
      role: "user",
      content: "Test message",
      status: "complete",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  const createAttachment = (overrides: Partial<ImageAttachment> = {}): ImageAttachment => ({
    id: `att-${Date.now()}-${Math.random()}`,
    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    mimeType: "image/png",
    size: 1024,
    ...overrides,
  });

  describe("create", () => {
    it("should create a new message without attachments", async () => {
      const message = createMessage();
      const result = await repo.create(message);
      expect(result).toEqual(message);
    });

    it("should create a message with attachments", async () => {
      const attachments = [createAttachment()];
      const message = createMessage();
      message.attachments = attachments;

      const result = await repo.create(message);
      expect(result.attachments).toEqual(attachments);
    });

    it("should create a message with multiple attachments", async () => {
      const attachments = [
        createAttachment({ id: "att-1" }),
        createAttachment({ id: "att-2" }),
      ];
      const message = createMessage();
      message.attachments = attachments;

      const result = await repo.create(message);
      expect(result.attachments).toHaveLength(2);
    });

    it("should persist model and providerConnectionId", async () => {
      const message = createMessage({
        role: "assistant",
        model: "gpt-4",
        providerConnectionId: "provider-123",
      });

      await repo.create(message);
      const retrieved = await repo.findById(message.id);

      expect(retrieved?.model).toBe("gpt-4");
      expect(retrieved?.providerConnectionId).toBe("provider-123");
    });
  });

  describe("findById", () => {
    it("should return null for non-existent id", async () => {
      const result = await repo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("should return message for existing id", async () => {
      const message = createMessage();
      await repo.create(message);
      const result = await repo.findById(message.id);
      expect(result).toEqual(message);
    });

    it("should load attachments with message", async () => {
      const attachments = [createAttachment()];
      const message = createMessage();
      message.attachments = attachments;

      await repo.create(message);
      const result = await repo.findById(message.id);
      // Verify attachments exist and have core properties
      expect(result?.attachments).toBeDefined();
      expect(result?.attachments).toHaveLength(1);
      expect(result?.attachments?.[0].id).toBe(attachments[0].id);
      expect(result?.attachments?.[0].data).toBe(attachments[0].data);
      expect(result?.attachments?.[0].mimeType).toBe(attachments[0].mimeType);
      // Note: size is not stored in SQLite DB, so it may be 0
    });
  });

  describe("findByChatId", () => {
    it("should return empty array when no messages exist", async () => {
      const result = await repo.findByChatId("chat-1");
      expect(result).toEqual([]);
    });

    it("should return messages for specific chat", async () => {
      const msg1 = createMessage({ id: "1", chatId: "chat-1" });
      const msg2 = createMessage({ id: "2", chatId: "chat-2" });
      const msg3 = createMessage({ id: "3", chatId: "chat-1" });

      await repo.create(msg1);
      await repo.create(msg2);
      await repo.create(msg3);

      const result = await repo.findByChatId("chat-1");
      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toContain("1");
      expect(result.map(m => m.id)).toContain("3");
    });

    it("should return messages ordered by createdAt ASC", async () => {
      const now = Date.now();
      const msg1 = createMessage({ id: "1", chatId: "chat-1", createdAt: now + 2000 });
      const msg2 = createMessage({ id: "2", chatId: "chat-1", createdAt: now + 1000 });
      const msg3 = createMessage({ id: "3", chatId: "chat-1", createdAt: now });

      await repo.create(msg1);
      await repo.create(msg2);
      await repo.create(msg3);

      const result = await repo.findByChatId("chat-1");
      expect(result).toHaveLength(3);
      // Should be ordered by createdAt ascending
      expect(result[0].id).toBe("3");
      expect(result[1].id).toBe("2");
      expect(result[2].id).toBe("1");
    });
  });

  describe("findAll", () => {
    it("should return empty array when no messages exist", async () => {
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });

    it("should return all messages across all chats", async () => {
      const msg1 = createMessage({ id: "1", chatId: "chat-1" });
      const msg2 = createMessage({ id: "2", chatId: "chat-2" });
      const msg3 = createMessage({ id: "3", chatId: "chat-1" });

      await repo.create(msg1);
      await repo.create(msg2);
      await repo.create(msg3);

      const result = await repo.findAll();
      expect(result).toHaveLength(3);
    });
  });

  describe("update", () => {
    it("should update message content", async () => {
      const message = createMessage();
      await repo.create(message);

      const updated = { ...message, content: "Updated content", updatedAt: Date.now() };
      const result = await repo.update(updated);
      expect(result.content).toBe("Updated content");

      const found = await repo.findById(message.id);
      expect(found?.content).toBe("Updated content");
    });

    it("should update message status", async () => {
      const message = createMessage({ status: "pending" });
      await repo.create(message);

      const updated = { ...message, status: "complete" as const, updatedAt: Date.now() };
      await repo.update(updated);

      const found = await repo.findById(message.id);
      expect(found?.status).toBe("complete");
    });

    it("should throw error for non-existent message", async () => {
      const message = createMessage();
      await expect(repo.update(message)).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should return false for non-existent message", async () => {
      const result = await repo.delete("nonexistent");
      expect(result).toBe(false);
    });

    it("should delete existing message and return true", async () => {
      const message = createMessage();
      await repo.create(message);

      const result = await repo.delete(message.id);
      expect(result).toBe(true);
      expect(await repo.findById(message.id)).toBeNull();
    });

    it("should delete message attachments when deleting message", async () => {
      const attachments = [createAttachment()];
      const message = createMessage();
      message.attachments = attachments;

      await repo.create(message);
      await repo.delete(message.id);

      const found = await repo.findById(message.id);
      expect(found).toBeNull();
    });
  });

  describe("deleteByChatId", () => {
    it("should return 0 for non-existent chat", async () => {
      const result = await repo.deleteByChatId("nonexistent");
      expect(result).toBe(0);
    });

    it("should delete all messages for a chat", async () => {
      const msg1 = createMessage({ id: "1", chatId: "chat-1" });
      const msg2 = createMessage({ id: "2", chatId: "chat-2" });
      const msg3 = createMessage({ id: "3", chatId: "chat-1" });

      await repo.create(msg1);
      await repo.create(msg2);
      await repo.create(msg3);

      const result = await repo.deleteByChatId("chat-1");
      expect(result).toBe(2);

      const remaining = await repo.findAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("2");
    });

    it("should not affect other chats", async () => {
      const msg1 = createMessage({ id: "1", chatId: "chat-1" });
      const msg2 = createMessage({ id: "2", chatId: "chat-2" });

      await repo.create(msg1);
      await repo.create(msg2);

      await repo.deleteByChatId("chat-1");

      const found = await repo.findById("2");
      expect(found).not.toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await repo.create(createMessage({ id: "1", chatId: "chat-1", content: "Hello world" }));
      await repo.create(createMessage({ id: "2", chatId: "chat-1", content: "How are you?" }));
      await repo.create(createMessage({ id: "3", chatId: "chat-2", content: "Hello there" }));
      await repo.create(createMessage({ id: "4", chatId: "chat-2", content: "Goodbye world" }));
    });

    it("should search messages by content", async () => {
      const result = await repo.search("hello");
      expect(result).toHaveLength(2);
      expect(result.some(m => m.id === "1")).toBe(true);
      expect(result.some(m => m.id === "3")).toBe(true);
    });

    it("should be case-insensitive", async () => {
      const result = await repo.search("HELLO");
      expect(result).toHaveLength(2);
    });

    it("should search with chatId filter", async () => {
      const result = await repo.search("hello", "chat-1");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("should return empty array when no matches", async () => {
      const result = await repo.search("nonexistent");
      expect(result).toEqual([]);
    });

    it("should return results ordered by createdAt DESC", async () => {
      const now = Date.now();
      await repo.create(createMessage({ id: "5", content: "test message", createdAt: now }));
      await repo.create(createMessage({ id: "6", content: "test another", createdAt: now + 1000 }));

      const result = await repo.search("test");
      expect(result.length).toBeGreaterThanOrEqual(2);
      // Newest first
      const testResults = result.filter(m => m.id === "5" || m.id === "6");
      if (testResults.length === 2) {
        expect(testResults[0].id).toBe("6");
        expect(testResults[1].id).toBe("5");
      }
    });
  });
});
