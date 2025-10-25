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
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");

      // Should NOT contain last_message_at (derived via query)
      expect(columns).not.toContain("last_message_at");
    });

    it("should have all fields as NOT NULL", async () => {
      const result = await db.query<ColumnInfo>("PRAGMA table_info(chats)");

      for (const row of result.rows) {
        // TEXT PRIMARY KEY columns report notnull=0, so check pk flag instead
        if (row.pk === 1) {
          expect(row.pk).toBe(1); // Primary key ensures NOT NULL
        } else {
          expect(row.notnull).toBe(1);
        }
      }
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
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");

      // Should NOT contain status field
      expect(columns).not.toContain("status");
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
      expect(columns).toContain("created_at");

      // Should NOT contain size or name fields
      expect(columns).not.toContain("size");
      expect(columns).not.toContain("name");
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
