// Domain types for Arc chat application

export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus =
  | "pending"    // Message created, not yet streaming
  | "streaming"  // Currently receiving content
  | "complete"   // Successfully finished
  | "stopped"    // User stopped the stream
  | "error";     // Failed to generate

export interface ImageAttachment {
  id: string;
  file: File;
  objectUrl: string;
  size: number;       // bytes
  type: string;       // MIME type (image/png, image/jpeg, etc.)
}

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  attachments?: ImageAttachment[];
  status: MessageStatus;
  createdAt: number;  // timestamp
  updatedAt: number;  // timestamp
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;  // timestamp
  updatedAt: number;  // timestamp
  lastMessageAt: number;  // timestamp for sorting
}
