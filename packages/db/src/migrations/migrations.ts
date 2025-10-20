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

-- Chats table (conversation threads)
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL
);

-- Index for sorting chats by most recent activity
CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at DESC);

-- Messages table (individual messages within chats)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'streaming', 'complete', 'stopped', 'error')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

-- Attachments table (image attachments for messages)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  data TEXT NOT NULL, -- Base64-encoded image data
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Index for fetching attachments by message
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

-- Provider configs table (AI provider API credentials)
CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('openai', 'anthropic', 'gemini', 'custom')),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT NOT NULL,
  default_model TEXT,
  custom_headers TEXT, -- JSON-serialized
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for finding enabled providers
CREATE INDEX IF NOT EXISTS idx_provider_configs_enabled ON provider_configs(enabled);

-- Settings table (app-level key-value settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`.trim(),
  },
];
