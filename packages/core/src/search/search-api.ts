import type { SearchEngine, SearchResult } from "./search-engine.js";
import type { IChatRepository } from "../chats/chat-repository.type.js";
import type { Chat } from "../chats/chat.js";

/**
 * Public API for search operations
 */
export class SearchAPI {
  private engine: SearchEngine;
  private chatRepo: IChatRepository;

  constructor(engine: SearchEngine, chatRepo: IChatRepository) {
    this.engine = engine;
    this.chatRepo = chatRepo;
  }

  /**
   * Search across all messages in all chats
   *
   * @param query - Search query string
   * @returns Search results with chat context
   */
  async messages(query: string): Promise<SearchResult[]> {
    return this.engine.searchMessages(query);
  }

  /**
   * Search messages within a specific chat
   *
   * @param chatId - ID of the chat to search within
   * @param query - Search query string
   * @returns Search results with chat context
   */
  async messagesInChat(chatId: string, query: string): Promise<SearchResult[]> {
    return this.engine.searchMessages(query, chatId);
  }

  /**
   * Search chats by title
   *
   * @param query - Search query string
   * @returns Chats with titles matching the query
   */
  async chats(query: string): Promise<Chat[]> {
    return this.chatRepo.search(query);
  }
}
