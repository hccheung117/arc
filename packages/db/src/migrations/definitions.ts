/**
 * Database migrations for Arc.
 *
 * Each migration is a SQL script executed sequentially. The scripts are written
 * to be idempotent so applying the same migration twice is a no-op.
 */

export interface Migration {
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    name: "0001_initial",
    sql: `
-- Migration 0001: Initial schema
-- Creates all core tables for Arc chat application

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Migrations table (meta table for tracking schema versions)
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- Provider connections table (AI provider API credentials)
CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK(provider_type IN ('openai', 'anthropic', 'gemini', 'custom')),
  api_key TEXT NOT NULL,
  base_url TEXT,
  custom_headers TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Unique constraint on provider connection name
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_connections_name ON provider_connections(name);

-- Chats table (conversation threads)
-- NOTE: No model or provider fields here - that's tracked per-message
-- NOTE: No last_message_at - derived via query instead
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  parent_chat_id TEXT,
  parent_message_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_chat_id) REFERENCES chats(id) ON DELETE SET NULL
);

-- Messages table (individual messages within chats)
-- This is the single source of truth for model and provider selection
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  provider_connection_id TEXT,
  token_count INTEGER,
  parent_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'complete' CHECK(status IN ('pending', 'streaming', 'complete', 'error', 'stopped')),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1)),
  pinned_at INTEGER,
  temperature REAL,
  system_prompt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Index for fetching messages by chat, ordered by creation time
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at ASC);

-- Message attachments table (image attachments for messages)
CREATE TABLE IF NOT EXISTS message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image')),
  mime_type TEXT NOT NULL,
  data TEXT NOT NULL,
  name TEXT,
  size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Index for fetching attachments by message
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);

-- Settings table (app-level key-value settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Full-text search virtual table for messages
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  content,
  tokenize='porter unicode61'
);

-- Trigger: Keep FTS index synchronized on INSERT
CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(message_id, content) VALUES (new.id, new.content);
END;

-- Trigger: Keep FTS index synchronized on DELETE
CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;

-- Trigger: Keep FTS index synchronized on UPDATE
CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
  UPDATE messages_fts SET content = new.content WHERE message_id = new.id;
END;
`.trim(),
  },
];
