/**
 * Chat entity representing a conversation
 */
export interface Chat {
  id: string;
  title: string;
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt: number; // Unix timestamp in milliseconds
  lastMessageAt: number; // Unix timestamp for sorting chats
  isTransient?: boolean; // If true, chat exists only in memory until first message
}
