import type { ImageAttachment } from "./ImageAttachment.js";

/**
 * Role of the message author
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Status of the message lifecycle
 */
export type MessageStatus =
  | "pending" // Message created, not yet streaming
  | "streaming" // Currently receiving content
  | "complete" // Successfully finished
  | "stopped" // User stopped the stream
  | "error"; // Failed to generate

/**
 * Message entity representing a single message in a chat
 */
export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  attachments?: ImageAttachment[];
  status: MessageStatus;
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt: number; // Unix timestamp in milliseconds
}
