import { describe, it, expect, beforeEach, vi } from "vitest";
import { SearchAPI } from "../src/search/search-api.js";
import type { SearchEngine, SearchResult } from "../src/search/search-engine.js";
import type { ChatRepository } from "../src/chats/chat-repository.type.js";
import type { Chat } from "../src/chats/chat.js";

/**
 * SearchAPI Tests
 *
 * Tests the SearchAPI with mocked search engine.
 */

describe("SearchAPI", () => {
  let api: SearchAPI;
  let mockEngine: SearchEngine;
  let mockChatRepo: ChatRepository;

  beforeEach(() => {
    mockEngine = {
      searchMessages: vi.fn(),
    };

    mockChatRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
    };

    api = new SearchAPI(mockEngine, mockChatRepo);
  });

  const mockResults: SearchResult[] = [
    {
      messageId: "msg-1",
      chatId: "chat-1",
      chatTitle: "Test Chat",
      content: "Hello world",
      snippet: "Hello world",
      createdAt: Date.now(),
    },
    {
      messageId: "msg-2",
      chatId: "chat-2",
      chatTitle: "Another Chat",
      content: "Hello there",
      snippet: "Hello there",
      createdAt: Date.now(),
    },
  ];

  describe("messages", () => {
    it("should call searchEngine.searchMessages with query", async () => {
      vi.mocked(mockEngine.searchMessages).mockResolvedValue(mockResults);

      const result = await api.messages("hello");

      expect(mockEngine.searchMessages).toHaveBeenCalledWith("hello");
      expect(result).toEqual(mockResults);
    });

    it("should return search results", async () => {
      vi.mocked(mockEngine.searchMessages).mockResolvedValue(mockResults);

      const result = await api.messages("hello");

      expect(result).toHaveLength(2);
      expect(result[0].messageId).toBe("msg-1");
      expect(result[1].messageId).toBe("msg-2");
    });
  });

  describe("messagesInChat", () => {
    it("should call searchEngine with chatId filter", async () => {
      const filteredResults = [mockResults[0]];
      vi.mocked(mockEngine.searchMessages).mockResolvedValue(filteredResults);

      const result = await api.messagesInChat("chat-1", "hello");

      expect(mockEngine.searchMessages).toHaveBeenCalledWith("hello", "chat-1");
      expect(result).toEqual(filteredResults);
    });

    it("should return filtered results", async () => {
      const filteredResults = [mockResults[0]];
      vi.mocked(mockEngine.searchMessages).mockResolvedValue(filteredResults);

      const result = await api.messagesInChat("chat-1", "hello");

      expect(result).toHaveLength(1);
      expect(result[0].chatId).toBe("chat-1");
    });
  });

  describe("chats", () => {
    it("should call chatRepo.search with query", async () => {
      const mockChats: Chat[] = [
        {
          id: "chat-1",
          title: "Test Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        },
      ];
      vi.mocked(mockChatRepo.search).mockResolvedValue(mockChats);

      const result = await api.chats("test");

      expect(mockChatRepo.search).toHaveBeenCalledWith("test");
      expect(result).toEqual(mockChats);
    });

    it("should return search results", async () => {
      const mockChats: Chat[] = [
        {
          id: "chat-1",
          title: "Test Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        },
        {
          id: "chat-2",
          title: "Another Test",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        },
      ];
      vi.mocked(mockChatRepo.search).mockResolvedValue(mockChats);

      const result = await api.chats("test");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("chat-1");
      expect(result[1].id).toBe("chat-2");
    });
  });
});
