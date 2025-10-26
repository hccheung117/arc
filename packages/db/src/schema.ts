/**
 * Database schema type definitions for @arc/db
 *
 * Provides TypeScript interfaces for all database entities. These types
 * mirror the SQL schema defined in migrations and serve as the contract
 * between the database layer and Core's repository implementations.
 */

/**
 * AI provider connection configuration.
 * Stores API credentials and connection details for various AI providers.
 */
export interface ProviderConnection {
  id: string;
  name: string;
  provider_type: "openai" | "anthropic" | "gemini" | "custom";
  api_key: string;
  base_url: string | null;
  custom_headers: string | null; // JSON-serialized map
  is_active: 0 | 1; // SQLite boolean
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number;
}

/**
 * Chat session metadata.
 * Represents a conversation thread. Contains no model or provider information,
 * as these are tracked per-message.
 */
export interface Chat {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

/**
 * Individual message within a chat.
 * This is the single source of truth for which model and provider were used
 * for any given message. Dynamic state like "current model" is derived by
 * querying the most recent message.
 */
export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null; // Which model was used (e.g., "gpt-4", "claude-3-opus")
  provider_connection_id: string | null; // Which provider connection was used
  token_count: number | null; // Tokens consumed (from provider response)
  parent_message_id: string | null; // For branching conversations
  status: "pending" | "streaming" | "complete" | "error" | "stopped"; // Message generation status
  created_at: number;
  updated_at: number;
}

/**
 * Image attachment for a message.
 * Stores base64-encoded image data or a platform-specific path/URL.
 */
export interface MessageAttachment {
  id: string;
  message_id: string;
  type: "image";
  mime_type: string;
  data: string; // Base64-encoded or path/URL
  name: string | null; // Optional filename
  size: number | null; // File size in bytes
  created_at: number;
}

/**
 * Application-level settings stored as key-value pairs.
 */
export interface Setting {
  key: string;
  value: string; // JSON-serialized
  updated_at: number;
}

/**
 * Migration tracking (meta table).
 * Automatically managed by the migration runner.
 */
export interface Migration {
  id: number;
  name: string;
  applied_at: number;
}
