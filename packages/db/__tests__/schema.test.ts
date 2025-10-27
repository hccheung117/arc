/**
 * Schema integrity tests for @arc/db
 *
 * Validates that the database schema matches the TypeScript type definitions
 * and that all expected columns, constraints, and relationships are correctly
 * defined.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createPlatform } from "@arc/platform";
import type { IPlatformDatabase } from "@arc/platform/contracts/database.js";
import { runMigrations } from "../src/migrations/runner.js";

type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: string | null;
  pk: 0 | 1;
};

describe("Schema Integrity", () => {
  let db: IPlatformDatabase;

  beforeEach(async () => {
    // Use electron platform which runs better-sqlite3 in Node.js
    const platform = await createPlatform("electron");
    db = platform.database;
    await db.init();
    await runMigrations(db);
  });

  describe("provider_connections table", () => {
    it("should have correct columns", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(provider_connections)");
      const columns = result.rows.map(row => row.name);

      expect(columns).toContain("id");
      expect(columns).toContain("name");
      expect(columns).toContain("provider_type");
      expect(columns).toContain("api_key");
      expect(columns).toContain("base_url");
      expect(columns).toContain("custom_headers");
      expect(columns).toContain("is_active");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");
    });

    it("should have id as primary key", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(provider_connections)");
      const idColumn = result.rows.find(row => row.name === "id");

      expect(idColumn?.pk).toBe(1);
    });

    it("should have NOT NULL constraints on required fields", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(provider_connections)");
      const columns = Object.fromEntries(
        result.rows.map(row => [row.name, row.notnull])
      );

      // Note: TEXT PRIMARY KEY columns report notnull=0 in SQLite, but are effectively NOT NULL
      // so we check pk flag separately
      const idColumn = result.rows.find(row => row.name === "id");
      expect(idColumn?.pk).toBe(1); // Primary key ensures NOT NULL

      expect(columns.name).toBe(1);
      expect(columns.provider_type).toBe(1);
      expect(columns.api_key).toBe(1);
      expect(columns.is_active).toBe(1);
      expect(columns.created_at).toBe(1);
      expect(columns.updated_at).toBe(1);
    });

    it("should allow NULL for optional fields", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(provider_connections)");
      const columns = Object.fromEntries(
        result.rows.map(row => [row.name, row.notnull])
      );

      expect(columns.base_url).toBe(0);
      expect(columns.custom_headers).toBe(0);
    });
  });

  describe("chats table", () => {
    it("should have correct columns", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(chats)");
      const columns = result.rows.map(row => row.name);

      expect(columns).toContain("id");
      expect(columns).toContain("title");
      expect(columns).toContain("parent_chat_id");
      expect(columns).toContain("parent_message_id");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");

      // Should NOT contain last_message_at (derived via query)
      expect(columns).not.toContain("last_message_at");
    });

    it("should have all required fields as NOT NULL", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(chats)");
      const columns = Object.fromEntries(
        result.rows.map(row => [row.name, row.notnull])
      );

      // Check primary key
      const idColumn = result.rows.find(row => row.name === "id");
      expect(idColumn?.pk).toBe(1);

      // Check required fields
      expect(columns.title).toBe(1);
      expect(columns.created_at).toBe(1);
      expect(columns.updated_at).toBe(1);

      // Check optional fields (for branching)
      expect(columns.parent_chat_id).toBe(0);
      expect(columns.parent_message_id).toBe(0);
    });

    it("should have foreign key to parent chat", async () => {
      const result = await db.query<{ table: string; from: string; to: string; on_delete: string }>(
        "PRAGMA foreign_key_list(chats)"
      );

      const parentFk = result.rows.find(row => row.from === "parent_chat_id");
      expect(parentFk).toBeDefined();
      expect(parentFk?.table).toBe("chats");
      expect(parentFk?.to).toBe("id");
      expect(parentFk?.on_delete).toBe("SET NULL");
    });
  });

  describe("messages table", () => {
    it("should have correct columns", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(messages)");
      const columns = result.rows.map(row => row.name);

      expect(columns).toContain("id");
      expect(columns).toContain("chat_id");
      expect(columns).toContain("role");
      expect(columns).toContain("content");
      expect(columns).toContain("model");
      expect(columns).toContain("provider_connection_id");
      expect(columns).toContain("token_count");
      expect(columns).toContain("parent_message_id");
      expect(columns).toContain("status");
      expect(columns).toContain("is_pinned");
      expect(columns).toContain("pinned_at");
      expect(columns).toContain("temperature");
      expect(columns).toContain("system_prompt");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");
    });

    it("should have foreign key to chats table", async () => {
      const result = await db.query<{ table: string; from: string; to: string }>(
        "PRAGMA foreign_key_list(messages)"
      );

      const chatFk = result.rows.find(row => row.table === "chats");
      expect(chatFk).toBeDefined();
      expect(chatFk?.from).toBe("chat_id");
      expect(chatFk?.to).toBe("id");
    });

    it("should have self-referential foreign key for parent_message_id", async () => {
      const result = await db.query<{ table: string; from: string; to: string }>(
        "PRAGMA foreign_key_list(messages)"
      );

      const parentFk = result.rows.find(row => row.from === "parent_message_id");
      expect(parentFk).toBeDefined();
      expect(parentFk?.table).toBe("messages");
      expect(parentFk?.to).toBe("id");
    });

    it("should allow NULL for optional fields", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(messages)");
      const columns = Object.fromEntries(
        result.rows.map(row => [row.name, row.notnull])
      );

      expect(columns.model).toBe(0);
      expect(columns.provider_connection_id).toBe(0);
      expect(columns.token_count).toBe(0);
      expect(columns.parent_message_id).toBe(0);
      expect(columns.pinned_at).toBe(0);
      expect(columns.temperature).toBe(0);
      expect(columns.system_prompt).toBe(0);
    });

    it("should have is_pinned default to 0", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(messages)");
      const isPinnedColumn = result.rows.find(row => row.name === "is_pinned");

      expect(isPinnedColumn?.notnull).toBe(1); // NOT NULL
      expect(isPinnedColumn?.dflt_value).toBe("0");
    });
  });

  describe("message_attachments table", () => {
    it("should have correct columns", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(message_attachments)");
      const columns = result.rows.map(row => row.name);

      expect(columns).toContain("id");
      expect(columns).toContain("message_id");
      expect(columns).toContain("type");
      expect(columns).toContain("mime_type");
      expect(columns).toContain("data");
      expect(columns).toContain("name");
      expect(columns).toContain("size");
      expect(columns).toContain("created_at");
    });

    it("should have foreign key to messages table", async () => {
      const result = await db.query<{ table: string; from: string; to: string }>(
        "PRAGMA foreign_key_list(message_attachments)"
      );

      const messageFk = result.rows.find(row => row.table === "messages");
      expect(messageFk).toBeDefined();
      expect(messageFk?.from).toBe("message_id");
      expect(messageFk?.to).toBe("id");
    });
  });

  describe("settings table", () => {
    it("should have correct columns", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(settings)");
      const columns = result.rows.map(row => row.name);

      expect(columns).toContain("key");
      expect(columns).toContain("value");
      expect(columns).toContain("updated_at");
    });

    it("should have key as primary key", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(settings)");
      const keyColumn = result.rows.find(row => row.name === "key");

      expect(keyColumn?.pk).toBe(1);
    });
  });

  describe("Data Insertion and Relationships", () => {
    it("should insert and retrieve a complete chat with message", async () => {
      const now = Date.now();
      const chatId = "chat-1";
      const messageId = "msg-1";

      // Insert chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test Chat", now, now]
      );

      // Insert message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, model, provider_connection_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [messageId, chatId, "user", "Hello", "gpt-4", null, now, now]
      );

      // Retrieve and verify
      const chatResult = await db.query<{ id: string; title: string }>(
        "SELECT id, title FROM chats WHERE id = ?",
        [chatId]
      );
      expect(chatResult.rows).toHaveLength(1);
      expect(chatResult.rows[0]?.title).toBe("Test Chat");

      const messageResult = await db.query<{ id: string; content: string; model: string }>(
        "SELECT id, content, model FROM messages WHERE id = ?",
        [messageId]
      );
      expect(messageResult.rows).toHaveLength(1);
      expect(messageResult.rows[0]?.content).toBe("Hello");
      expect(messageResult.rows[0]?.model).toBe("gpt-4");
    });

    it("should derive last_message_at from messages", async () => {
      const now = Date.now();
      const chatId = "chat-1";

      // Insert chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test Chat", now, now]
      );

      // Insert messages with different timestamps
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ["msg-1", chatId, "user", "First", now, now]
      );

      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ["msg-2", chatId, "assistant", "Second", now + 1000, now + 1000]
      );

      // Query for last message timestamp
      const result = await db.query<{ last_message_at: number }>(
        `SELECT MAX(m.created_at) as last_message_at
         FROM messages m
         WHERE m.chat_id = ?`,
        [chatId]
      );

      expect(result.rows[0]?.last_message_at).toBe(now + 1000);
    });

    it("should support branching conversations with parent_message_id", async () => {
      const now = Date.now();
      const chatId = "chat-1";

      // Create chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test", now, now]
      );

      // Create parent message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ["msg-1", chatId, "user", "Parent", now, now]
      );

      // Create child message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, parent_message_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["msg-2", chatId, "assistant", "Child", "msg-1", now + 1000, now + 1000]
      );

      // Verify relationship
      const result = await db.query<{ id: string; parent_message_id: string | null }>(
        "SELECT id, parent_message_id FROM messages WHERE id = ?",
        ["msg-2"]
      );

      expect(result.rows[0]?.parent_message_id).toBe("msg-1");
    });
  });

  describe("Chat Branching", () => {
    it("should support branching chats with parent relationship", async () => {
      const now = Date.now();
      const parentChatId = "parent-chat";
      const branchedChatId = "branched-chat";
      const parentMessageId = "parent-msg";

      // Create parent chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [parentChatId, "Parent Chat", now, now]
      );

      // Create a message in the parent chat
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [parentMessageId, parentChatId, "user", "Original message", now, now]
      );

      // Create branched chat referencing parent
      await db.exec(
        "INSERT INTO chats (id, title, parent_chat_id, parent_message_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [branchedChatId, "Branched Chat", parentChatId, parentMessageId, now + 1000, now + 1000]
      );

      // Verify branched chat has correct parent references
      const result = await db.query<{ parent_chat_id: string; parent_message_id: string }>(
        "SELECT parent_chat_id, parent_message_id FROM chats WHERE id = ?",
        [branchedChatId]
      );

      expect(result.rows[0]?.parent_chat_id).toBe(parentChatId);
      expect(result.rows[0]?.parent_message_id).toBe(parentMessageId);
    });

    it("should set parent_chat_id to NULL when parent chat is deleted", async () => {
      const now = Date.now();
      const parentChatId = "parent-chat-delete";
      const branchedChatId = "branched-chat-delete";

      // Create parent chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [parentChatId, "Parent Chat", now, now]
      );

      // Create branched chat
      await db.exec(
        "INSERT INTO chats (id, title, parent_chat_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [branchedChatId, "Branched Chat", parentChatId, now + 1000, now + 1000]
      );

      // Delete parent chat
      await db.exec("DELETE FROM chats WHERE id = ?", [parentChatId]);

      // Verify parent_chat_id is now NULL
      const result = await db.query<{ parent_chat_id: string | null }>(
        "SELECT parent_chat_id FROM chats WHERE id = ?",
        [branchedChatId]
      );

      expect(result.rows[0]?.parent_chat_id).toBeNull();
    });
  });

  describe("Message Pinning", () => {
    it("should support pinning messages with timestamps", async () => {
      const now = Date.now();
      const chatId = "chat-pin";
      const messageId = "msg-pin";

      // Create chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test Chat", now, now]
      );

      // Create message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [messageId, chatId, "assistant", "Important message", now, now]
      );

      // Pin the message
      const pinnedAt = now + 5000;
      await db.exec(
        "UPDATE messages SET is_pinned = 1, pinned_at = ? WHERE id = ?",
        [pinnedAt, messageId]
      );

      // Verify pinning
      const result = await db.query<{ is_pinned: number; pinned_at: number }>(
        "SELECT is_pinned, pinned_at FROM messages WHERE id = ?",
        [messageId]
      );

      expect(result.rows[0]?.is_pinned).toBe(1);
      expect(result.rows[0]?.pinned_at).toBe(pinnedAt);
    });

    it("should have is_pinned default to 0 for new messages", async () => {
      const now = Date.now();
      const chatId = "chat-default-pin";
      const messageId = "msg-default-pin";

      // Create chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test Chat", now, now]
      );

      // Create message without specifying is_pinned
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [messageId, chatId, "user", "Regular message", now, now]
      );

      // Verify is_pinned defaults to 0
      const result = await db.query<{ is_pinned: number; pinned_at: number | null }>(
        "SELECT is_pinned, pinned_at FROM messages WHERE id = ?",
        [messageId]
      );

      expect(result.rows[0]?.is_pinned).toBe(0);
      expect(result.rows[0]?.pinned_at).toBeNull();
    });

    it("should query pinned messages ordered by pinned_at", async () => {
      const now = Date.now();
      const chatId = "chat-multi-pin";

      // Create chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test Chat", now, now]
      );

      // Create and pin multiple messages
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, is_pinned, pinned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["msg-1", chatId, "user", "First pin", 1, now + 2000, now, now]
      );
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, is_pinned, pinned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["msg-2", chatId, "user", "Second pin", 1, now + 1000, now, now]
      );
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, is_pinned, pinned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["msg-3", chatId, "user", "Not pinned", 0, null, now, now]
      );

      // Query pinned messages ordered by pinned_at
      const result = await db.query<{ id: string; content: string }>(
        "SELECT id, content FROM messages WHERE chat_id = ? AND is_pinned = 1 ORDER BY pinned_at ASC",
        [chatId]
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]?.id).toBe("msg-2"); // Pinned earlier
      expect(result.rows[1]?.id).toBe("msg-1"); // Pinned later
    });
  });

  describe("Advanced Message Parameters", () => {
    it("should store temperature and system_prompt with messages", async () => {
      const now = Date.now();
      const chatId = "chat-params";
      const messageId = "msg-params";

      // Create chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test Chat", now, now]
      );

      // Create message with advanced parameters
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, temperature, system_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [messageId, chatId, "assistant", "Response", 0.7, "You are a helpful assistant.", now, now]
      );

      // Verify parameters
      const result = await db.query<{ temperature: number; system_prompt: string }>(
        "SELECT temperature, system_prompt FROM messages WHERE id = ?",
        [messageId]
      );

      expect(result.rows[0]?.temperature).toBe(0.7);
      expect(result.rows[0]?.system_prompt).toBe("You are a helpful assistant.");
    });

    it("should allow NULL for temperature and system_prompt", async () => {
      const now = Date.now();
      const chatId = "chat-params-null";
      const messageId = "msg-params-null";

      // Create chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chatId, "Test Chat", now, now]
      );

      // Create message without parameters
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [messageId, chatId, "user", "Question", now, now]
      );

      // Verify NULL values
      const result = await db.query<{ temperature: number | null; system_prompt: string | null }>(
        "SELECT temperature, system_prompt FROM messages WHERE id = ?",
        [messageId]
      );

      expect(result.rows[0]?.temperature).toBeNull();
      expect(result.rows[0]?.system_prompt).toBeNull();
    });
  });

  describe("Settings Storage", () => {
    it("should store and retrieve JSON arrays for model favoriting", async () => {
      const now = Date.now();
      const favoriteModels = ["openai:gpt-4", "anthropic:claude-3-5-sonnet"];

      // Store as JSON
      await db.exec(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ["favoriteModels", JSON.stringify(favoriteModels), now]
      );

      // Retrieve and parse
      const result = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        ["favoriteModels"]
      );

      const retrieved = JSON.parse(result.rows[0]?.value || "[]");
      expect(retrieved).toEqual(favoriteModels);
    });

    it("should store and retrieve JSON arrays for model whitelisting", async () => {
      const now = Date.now();
      const whitelistedModels = ["openai:gpt-4", "anthropic:claude-3-opus"];

      // Store as JSON
      await db.exec(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ["whitelistedModels", JSON.stringify(whitelistedModels), now]
      );

      // Retrieve and parse
      const result = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        ["whitelistedModels"]
      );

      const retrieved = JSON.parse(result.rows[0]?.value || "[]");
      expect(retrieved).toEqual(whitelistedModels);
    });

    it("should store and retrieve all new setting types", async () => {
      const now = Date.now();

      // Insert multiple settings
      await db.exec(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ["lineHeight", JSON.stringify("relaxed"), now]
      );
      await db.exec(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ["fontFamily", JSON.stringify("serif"), now]
      );
      await db.exec(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ["autoTitleChats", JSON.stringify(true), now]
      );
      await db.exec(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ["defaultSystemPrompt", JSON.stringify("You are a helpful assistant."), now]
      );

      // Retrieve all
      const lineHeight = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        ["lineHeight"]
      );
      const fontFamily = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        ["fontFamily"]
      );
      const autoTitle = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        ["autoTitleChats"]
      );
      const systemPrompt = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        ["defaultSystemPrompt"]
      );

      expect(JSON.parse(lineHeight.rows[0]?.value || "")).toBe("relaxed");
      expect(JSON.parse(fontFamily.rows[0]?.value || "")).toBe("serif");
      expect(JSON.parse(autoTitle.rows[0]?.value || "false")).toBe(true);
      expect(JSON.parse(systemPrompt.rows[0]?.value || "")).toBe("You are a helpful assistant.");
    });
  });

  describe("Schema Version Tracking", () => {
    it("should track applied migrations", async () => {
      const result = await db.query<{ name: string }>(
        "SELECT name FROM migrations ORDER BY id ASC"
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0]?.name).toBe("0001_initial");
    });
  });
});
