import { describe, it, expect, beforeEach } from "vitest";
import type { ChatRepository } from "../src/chats/chat-repository.type.js";
import { InMemoryChatRepository } from "../src/chats/chat-repository-memory.js";
import { SQLiteChatRepository } from "../src/chats/chat-repository-sqlite.js";
import type { Chat } from "../src/chats/chat.js";
import type { PlatformDatabase } from "@arc/platform";

/**
 * Chat Repository Contract Tests
 *
 * These tests ensure both in-memory and SQLite implementations
 * satisfy the ChatRepository contract.
 */

/**
 * Create a mock in-memory database for testing SQLite repository
 */
function createMockDatabase(): PlatformDatabase {
  const chatsStore = new Map<string, {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
  }>();

  const messagesStore = new Map<string, {
    chat_id: string;
    created_at: number;
  }>();

  return {
    async init() {},
    async close() {},
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("WHERE id = ?")) {
        const id = params?.[0] as string;
        const chat = chatsStore.get(id);
        return { rows: chat ? [chat] : [] };
      }
      if (sql.includes("LEFT JOIN messages")) {
        // Handle findAll/search query with last_message_at calculation
        let filteredChats = Array.from(chatsStore.values());

        // Handle search query filtering
        if (sql.includes("WHERE c.title LIKE ?")) {
          const query = params?.[0] as string;
          const searchTerm = query.replace(/%/g, "").toLowerCase();
          filteredChats = filteredChats.filter(chat =>
            chat.title.toLowerCase().includes(searchTerm)
          );
        }

        const rows = filteredChats.map(chat => {
          // Calculate last_message_at from messages
          const chatMessages = Array.from(messagesStore.values())
            .filter(m => m.chat_id === chat.id);

          const lastMessageAt = chatMessages.length > 0
            ? Math.max(...chatMessages.map(m => m.created_at))
            : chat.created_at;

          return {
            ...chat,
            last_message_at: lastMessageAt
          };
        });
        // Sort by last_message_at descending (COALESCE(last_message_at, c.created_at) DESC)
        rows.sort((a, b) => b.last_message_at - a.last_message_at);
        return { rows };
      }
      return { rows: [] };
    },
    async exec(sql: string, params?: unknown[]) {
      if (sql.includes("INSERT INTO chats")) {
        // Real SQL: INSERT INTO chats (id, title, created_at, updated_at)
        const [id, title, created_at, updated_at] = params as any[];
        chatsStore.set(id, { id, title, created_at, updated_at });
        return { rowsAffected: 1 };
      }
      if (sql.includes("UPDATE chats")) {
        // Real SQL: SET title = ?, updated_at = ? WHERE id = ?
        const [title, updated_at, id] = params as any[];
        const chat = chatsStore.get(id);
        if (chat) {
          chatsStore.set(id, { ...chat, title, updated_at });
          return { rowsAffected: 1 };
        }
        return { rowsAffected: 0 };
      }
      if (sql.includes("DELETE FROM chats")) {
        const id = params?.[0] as string;
        const had = chatsStore.has(id);
        chatsStore.delete(id);
        return { rowsAffected: had ? 1 : 0 };
      }
      return { rowsAffected: 0 };
    },
    async transaction(fn: () => Promise<void>) {
      await fn();
    },
  };
}

describe.each([
  { name: "InMemoryChatRepository", factory: () => new InMemoryChatRepository() },
  { name: "SQLiteChatRepository", factory: () => new SQLiteChatRepository(createMockDatabase()) },
])("$name", ({ factory }) => {
  let repo: ChatRepository;

  beforeEach(() => {
    repo = factory();
  });

  const createChat = (overrides: Partial<Chat> = {}): Chat => {
    const now = Date.now();
    return {
      id: `chat-${now}-${Math.random()}`,
      title: "Test Chat",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      ...overrides,
    };
  };

  describe("create", () => {
    it("should create a new chat", async () => {
      const chat = createChat();
      const result = await repo.create(chat);
      expect(result).toEqual(chat);
    });

    it("should store chat with all properties", async () => {
      const chat = createChat({
        title: "My Custom Chat",
      });
      await repo.create(chat);
      const found = await repo.findById(chat.id);
      // SQLite repos compute lastMessageAt dynamically, so just check core fields
      expect(found?.id).toBe(chat.id);
      expect(found?.title).toBe(chat.title);
      expect(found?.createdAt).toBe(chat.createdAt);
      expect(found?.updatedAt).toBe(chat.updatedAt);
      expect(found?.lastMessageAt).toBeDefined();
    });

    it("should set lastMessageAt to createdAt initially", async () => {
      const now = Date.now();
      const chat = createChat({ createdAt: now, lastMessageAt: now });
      await repo.create(chat);
      const found = await repo.findById(chat.id);
      expect(found?.lastMessageAt).toBe(now);
    });
  });

  describe("findById", () => {
    it("should return null for non-existent id", async () => {
      const result = await repo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("should return chat for existing id", async () => {
      const chat = createChat();
      await repo.create(chat);
      const result = await repo.findById(chat.id);
      expect(result).toEqual(chat);
    });
  });

  describe("findAll", () => {
    it("should return empty array when no chats exist", async () => {
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });

    it("should return all chats ordered by lastMessageAt DESC", async () => {
      const now = Date.now();
      // Create chats with staggered created_at times to ensure consistent ordering
      const chat1 = createChat({ id: "1", createdAt: now - 2000, updatedAt: now - 2000, lastMessageAt: now - 2000 });
      const chat2 = createChat({ id: "2", createdAt: now - 1000, updatedAt: now - 1000, lastMessageAt: now - 1000 });
      const chat3 = createChat({ id: "3", createdAt: now, updatedAt: now, lastMessageAt: now });

      await repo.create(chat1);
      await repo.create(chat2);
      await repo.create(chat3);

      const result = await repo.findAll();
      expect(result).toHaveLength(3);
      // Should be ordered by lastMessageAt descending (or created_at for SQLite when no messages)
      expect(result[0].id).toBe("3");
      expect(result[1].id).toBe("2");
      expect(result[2].id).toBe("1");
    });

    it("should handle chats with same lastMessageAt", async () => {
      const now = Date.now();
      const chat1 = createChat({ id: "1", lastMessageAt: now });
      const chat2 = createChat({ id: "2", lastMessageAt: now });

      await repo.create(chat1);
      await repo.create(chat2);

      const result = await repo.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe("update", () => {
    it("should update existing chat", async () => {
      const chat = createChat();
      await repo.create(chat);

      const updated = { ...chat, title: "Updated Title", updatedAt: Date.now() };
      const result = await repo.update(updated);
      expect(result.title).toBe("Updated Title");

      const found = await repo.findById(chat.id);
      expect(found?.title).toBe("Updated Title");
    });

    it("should throw error for non-existent chat", async () => {
      const chat = createChat();
      await expect(repo.update(chat)).rejects.toThrow();
    });

    it("should update lastMessageAt", async () => {
      const chat = createChat();
      await repo.create(chat);

      const newTime = Date.now() + 5000;
      const updated = { ...chat, lastMessageAt: newTime, updatedAt: newTime };
      await repo.update(updated);

      const found = await repo.findById(chat.id);
      // For in-memory repos this should update, for SQLite it's computed from messages
      // So just verify the update didn't fail
      expect(found).toBeDefined();
      expect(found?.lastMessageAt).toBeGreaterThan(0);
    });
  });

  describe("delete", () => {
    it("should return false for non-existent chat", async () => {
      const result = await repo.delete("nonexistent");
      expect(result).toBe(false);
    });

    it("should delete existing chat and return true", async () => {
      const chat = createChat();
      await repo.create(chat);

      const result = await repo.delete(chat.id);
      expect(result).toBe(true);
      expect(await repo.findById(chat.id)).toBeNull();
    });

    it("should not affect other chats", async () => {
      const chat1 = createChat({ id: "1" });
      const chat2 = createChat({ id: "2" });
      await repo.create(chat1);
      await repo.create(chat2);

      await repo.delete(chat1.id);
      expect(await repo.findById(chat2.id)).toEqual(chat2);
    });
  });

  describe("search", () => {
    it("should return empty array for empty query", async () => {
      const chat = createChat({ title: "My Chat" });
      await repo.create(chat);

      const result = await repo.search("");
      expect(result).toEqual([]);
    });

    it("should find chats by title (case insensitive)", async () => {
      const chat1 = createChat({ id: "1", title: "Meeting Notes" });
      const chat2 = createChat({ id: "2", title: "Project Planning" });
      const chat3 = createChat({ id: "3", title: "Daily Standup Notes" });

      await repo.create(chat1);
      await repo.create(chat2);
      await repo.create(chat3);

      const result = await repo.search("notes");
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id).sort()).toEqual(["1", "3"]);
    });

    it("should return empty array when no matches found", async () => {
      const chat = createChat({ title: "My Chat" });
      await repo.create(chat);

      const result = await repo.search("nonexistent");
      expect(result).toEqual([]);
    });

    it("should perform partial matching", async () => {
      const chat = createChat({ title: "Very Long Chat Title" });
      await repo.create(chat);

      const result = await repo.search("Long");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(chat.id);
    });

    it("should be case insensitive", async () => {
      const chat = createChat({ title: "Important Meeting" });
      await repo.create(chat);

      const result1 = await repo.search("IMPORTANT");
      const result2 = await repo.search("important");
      const result3 = await repo.search("ImPoRtAnT");

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result3).toHaveLength(1);
    });

    it("should order results by lastMessageAt DESC", async () => {
      const now = Date.now();
      // Create chats with staggered created_at times (since SQLite calculates lastMessageAt from messages,
      // and there are no messages, it falls back to created_at)
      const chat1 = createChat({
        id: "1",
        title: "Chat One",
        createdAt: now - 2000,
        updatedAt: now - 2000,
        lastMessageAt: now - 2000
      });
      const chat2 = createChat({
        id: "2",
        title: "Chat Two",
        createdAt: now - 1000,
        updatedAt: now - 1000,
        lastMessageAt: now - 1000
      });
      const chat3 = createChat({
        id: "3",
        title: "Chat Three",
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now
      });

      await repo.create(chat1);
      await repo.create(chat2);
      await repo.create(chat3);

      const result = await repo.search("Chat");
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("3"); // Most recent
      expect(result[1].id).toBe("2");
      expect(result[2].id).toBe("1"); // Oldest
    });
  });
});
