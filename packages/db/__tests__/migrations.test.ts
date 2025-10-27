/**
 * Migration tests for @arc/db
 *
 * Validates that migrations apply cleanly, are idempotent, and create the
 * expected schema. Uses an in-memory SQLite database for fast, isolated testing.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createPlatform } from "@arc/platform";
import type { PlatformDatabase } from "@arc/platform/contracts/database.js";
import { runMigrations, getSchemaVersion } from "../src/migrations/runner.js";
import { MigrationError } from "../src/db-errors.js";

describe("Migration Runner", () => {
  let db: PlatformDatabase;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    // Use electron platform which runs better-sqlite3 in Node.js
    const platform = await createPlatform("electron");
    db = platform.database;
    await db.init();
  });

  describe("Fresh Database", () => {
    it("should apply all migrations to a fresh database", async () => {
      const count = await runMigrations(db);

      expect(count).toBeGreaterThan(0);

      // Verify schema version matches number of migrations
      const version = await getSchemaVersion(db);
      expect(version).toBe(count);
    });

    it("should create all expected tables", async () => {
      await runMigrations(db);

      // Query sqlite_master to verify all tables exist
      const result = await db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const tableNames = result.rows.map(row => row.name);

      expect(tableNames).toContain("migrations");
      expect(tableNames).toContain("provider_connections");
      expect(tableNames).toContain("chats");
      expect(tableNames).toContain("messages");
      expect(tableNames).toContain("message_attachments");
      expect(tableNames).toContain("settings");
      expect(tableNames).toContain("messages_fts");
    });

    it("should create all expected indexes", async () => {
      await runMigrations(db);

      // Query for indexes
      const result = await db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );

      const indexNames = result.rows.map(row => row.name);

      expect(indexNames).toContain("idx_provider_connections_name");
      expect(indexNames).toContain("idx_messages_chat_id_created_at");
      expect(indexNames).toContain("idx_message_attachments_message_id");
    });

    it("should create FTS triggers", async () => {
      await runMigrations(db);

      // Query for triggers
      const result = await db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name"
      );

      const triggerNames = result.rows.map(row => row.name);

      expect(triggerNames).toContain("messages_fts_insert");
      expect(triggerNames).toContain("messages_fts_delete");
      expect(triggerNames).toContain("messages_fts_update");
    });
  });

  describe("Idempotency", () => {
    it("should be safe to run migrations multiple times", async () => {
      // Run migrations first time
      const count1 = await runMigrations(db);
      expect(count1).toBeGreaterThan(0);

      // Run migrations second time
      const count2 = await runMigrations(db);
      expect(count2).toBe(0); // No new migrations applied

      // Verify schema version unchanged
      const version = await getSchemaVersion(db);
      expect(version).toBe(count1);
    });

    it("should not duplicate data on repeated runs", async () => {
      await runMigrations(db);

      // Insert test data
      await db.exec(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        ["test_key", "test_value", Date.now()]
      );

      // Run migrations again
      await runMigrations(db);

      // Verify data still exists and is not duplicated
      const result = await db.query<{ key: string }>(
        "SELECT key FROM settings WHERE key = ?",
        ["test_key"]
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  describe("Schema Integrity", () => {
    beforeEach(async () => {
      await runMigrations(db);
    });

    it("should enforce foreign key constraints", async () => {
      // Try to insert a message with non-existent chat_id
      await expect(
        db.exec(
          "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          ["msg1", "nonexistent_chat", "user", "test", Date.now(), Date.now()]
        )
      ).rejects.toThrow();
    });

    it("should cascade delete messages when chat is deleted", async () => {
      const now = Date.now();

      // Create a chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ["chat1", "Test Chat", now, now]
      );

      // Create a message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ["msg1", "chat1", "user", "test", now, now]
      );

      // Delete the chat
      await db.exec("DELETE FROM chats WHERE id = ?", ["chat1"]);

      // Verify message was also deleted
      const result = await db.query<{ id: string }>(
        "SELECT id FROM messages WHERE id = ?",
        ["msg1"]
      );

      expect(result.rows).toHaveLength(0);
    });

    it("should enforce CHECK constraints on provider_type", async () => {
      const now = Date.now();

      // Try to insert provider with invalid type
      await expect(
        db.exec(
          "INSERT INTO provider_connections (id, name, provider_type, api_key, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          ["p1", "Test", "invalid_type", "key", 1, now, now]
        )
      ).rejects.toThrow();
    });

    it("should enforce CHECK constraints on message role", async () => {
      const now = Date.now();

      // Create a chat first
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ["chat1", "Test", now, now]
      );

      // Try to insert message with invalid role
      await expect(
        db.exec(
          "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          ["msg1", "chat1", "invalid_role", "test", now, now]
        )
      ).rejects.toThrow();
    });

    it("should enforce UNIQUE constraint on provider connection name", async () => {
      const now = Date.now();

      // Insert first provider
      await db.exec(
        "INSERT INTO provider_connections (id, name, provider_type, api_key, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["p1", "OpenAI", "openai", "key1", 1, now, now]
      );

      // Try to insert second provider with same name
      await expect(
        db.exec(
          "INSERT INTO provider_connections (id, name, provider_type, api_key, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          ["p2", "OpenAI", "openai", "key2", 1, now, now]
        )
      ).rejects.toThrow();
    });
  });

  describe("FTS Integration", () => {
    beforeEach(async () => {
      await runMigrations(db);
    });

    it("should automatically index new messages", async () => {
      const now = Date.now();

      // Create a chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ["chat1", "Test", now, now]
      );

      // Create a message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ["msg1", "chat1", "user", "hello world", now, now]
      );

      // Verify it's searchable via FTS
      const result = await db.query<{ message_id: string }>(
        "SELECT message_id FROM messages_fts WHERE content MATCH ?",
        ["hello"]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.message_id).toBe("msg1");
    });

    it("should update FTS index when message content changes", async () => {
      const now = Date.now();

      // Create a chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ["chat1", "Test", now, now]
      );

      // Create a message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ["msg1", "chat1", "user", "original content", now, now]
      );

      // Update the message
      await db.exec(
        "UPDATE messages SET content = ? WHERE id = ?",
        ["updated content", "msg1"]
      );

      // Old content should not be found
      const oldResult = await db.query<{ message_id: string }>(
        "SELECT message_id FROM messages_fts WHERE content MATCH ?",
        ["original"]
      );
      expect(oldResult.rows).toHaveLength(0);

      // New content should be found
      const newResult = await db.query<{ message_id: string }>(
        "SELECT message_id FROM messages_fts WHERE content MATCH ?",
        ["updated"]
      );
      expect(newResult.rows).toHaveLength(1);
    });

    it("should remove from FTS index when message is deleted", async () => {
      const now = Date.now();

      // Create a chat
      await db.exec(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        ["chat1", "Test", now, now]
      );

      // Create a message
      await db.exec(
        "INSERT INTO messages (id, chat_id, role, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ["msg1", "chat1", "user", "hello world", now, now]
      );

      // Delete the message
      await db.exec("DELETE FROM messages WHERE id = ?", ["msg1"]);

      // Verify it's no longer searchable
      const result = await db.query<{ message_id: string }>(
        "SELECT message_id FROM messages_fts WHERE content MATCH ?",
        ["hello"]
      );

      expect(result.rows).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should wrap migration errors in MigrationError", async () => {
      // Manually corrupt the database to force a migration error
      // Create the migrations table with wrong schema
      await db.exec("CREATE TABLE migrations (wrong_column TEXT)");

      // Attempt to run migrations should throw MigrationError
      await expect(runMigrations(db)).rejects.toThrow(MigrationError);
    });
  });
});
