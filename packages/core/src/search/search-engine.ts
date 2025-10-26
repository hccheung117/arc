import type { Message } from "../messages/message.js";
import type { MessageRepository } from "../messages/message-repository.type.js";
import type { ChatRepository } from "../chats/chat-repository.type.js";

/**
 * Search result with chat context
 */
export interface SearchResult {
  message: Message;
  chatId: string;
  chatTitle: string;
}

/**
 * Internal search engine
 *
 * Provides full-text search capabilities across messages.
 * Uses the repository's search method which may leverage SQLite FTS.
 */
export class SearchEngine {
  private messageRepo: MessageRepository;
  private chatRepo: ChatRepository;

  constructor(messageRepo: MessageRepository, chatRepo: ChatRepository) {
    this.messageRepo = messageRepo;
    this.chatRepo = chatRepo;
  }

  /**
   * Search messages by content
   *
   * @param query - Search query string
   * @param chatId - Optional chat ID to scope the search
   * @returns Search results with chat context, sorted by relevance/date
   */
  async searchMessages(
    query: string,
    chatId?: string
  ): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    // Search messages
    const messages = await this.messageRepo.search(query, chatId);

    // Enrich with chat context
    const results: SearchResult[] = [];
    for (const message of messages) {
      const chat = await this.chatRepo.findById(message.chatId);
      if (chat) {
        results.push({
          message,
          chatId: chat.id,
          chatTitle: chat.title,
        });
      }
    }

    return results;
  }
}
