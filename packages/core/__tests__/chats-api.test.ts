import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatsAPI, type SendMessageParams } from "../src/chats/chats-api.js";
import type { ChatRepository } from "../src/chats/chat-repository.type.js";
import type { MessageRepository } from "../src/messages/message-repository.type.js";
import type { Chat } from "../src/chats/chat.js";
import type { Message } from "../src/messages/message.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { PlatformDatabase } from "@arc/platform";

/**
 * ChatsAPI Tests
 *
 * These tests verify the ChatsAPI orchestration logic
 * with mocked dependencies.
 */

describe("ChatsAPI", () => {
  let api: ChatsAPI;
  let mockChatRepo: ChatRepository;
  let mockMessageRepo: MessageRepository;
  let mockDb: PlatformDatabase;
  let mockGetProvider: (configId: string) => Promise<Provider>;
  let mockProvider: Provider;

  beforeEach(() => {
    mockChatRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockMessageRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByChatId: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByChatId: vi.fn(),
      search: vi.fn(),
    };

    mockDb = {
      init: vi.fn(),
      close: vi.fn(),
      query: vi.fn(),
      exec: vi.fn(),
      transaction: vi.fn(async (fn) => await fn()),
    };

    mockProvider = {
      generateChatCompletion: vi.fn(),
      streamChatCompletion: vi.fn(),
      listModels: vi.fn(),
      healthCheck: vi.fn(),
      getCapabilities: vi.fn(),
    };

    mockGetProvider = vi.fn(async () => mockProvider);

    api = new ChatsAPI(mockChatRepo, mockMessageRepo, mockDb, mockGetProvider);
  });

  describe("create", () => {
    it("should return PendingChat builder", () => {
      const pendingChat = api.create();
      expect(pendingChat).toBeDefined();
      expect(pendingChat.id).toBeDefined();
      expect(pendingChat.title).toBe("New Chat");
    });

    it("should use provided title", () => {
      const pendingChat = api.create({ title: "My Custom Chat" });
      expect(pendingChat.title).toBe("My Custom Chat");
    });

    it("should not touch database", async () => {
      api.create();
      expect(mockChatRepo.create).not.toHaveBeenCalled();
    });

    it("should generate unique chat IDs", () => {
      const pending1 = api.create();
      const pending2 = api.create();
      expect(pending1.id).not.toBe(pending2.id);
    });
  });

  describe("get", () => {
    const chat: Chat = {
      id: "chat-1",
      title: "Test Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
    };

    const messages: Message[] = [
      {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        content: "Hello",
        status: "complete",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "msg-2",
        chatId: "chat-1",
        role: "assistant",
        content: "Hi there!",
        status: "complete",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    it("should return chat with messages", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);

      const result = await api.get("chat-1");

      expect(result).toBeDefined();
      expect(result?.chat).toEqual(chat);
      expect(result?.messages).toEqual(messages);
    });

    it("should return null for non-existent chat", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(null);

      const result = await api.get("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("should return all chats from repository", async () => {
      const chats: Chat[] = [
        {
          id: "chat-1",
          title: "Chat 1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        },
        {
          id: "chat-2",
          title: "Chat 2",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        },
      ];

      vi.mocked(mockChatRepo.findAll).mockResolvedValue(chats);

      const result = await api.list();
      expect(result).toEqual(chats);
    });
  });

  describe("rename", () => {
    const chat: Chat = {
      id: "chat-1",
      title: "Old Title",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
    };

    it("should update chat title", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);

      await api.rename("chat-1", "New Title");

      expect(mockChatRepo.update).toHaveBeenCalled();
      const updatedChat = vi.mocked(mockChatRepo.update).mock.calls[0][0];
      expect(updatedChat.title).toBe("New Title");
    });

    it("should throw for non-existent chat", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(null);

      await expect(api.rename("nonexistent", "New Title")).rejects.toThrow("Chat nonexistent not found");
    });
  });

  describe("delete", () => {
    it("should delete chat and all messages in transaction", async () => {
      vi.mocked(mockMessageRepo.deleteByChatId).mockResolvedValue(3);
      vi.mocked(mockChatRepo.delete).mockResolvedValue(true);

      await api.delete("chat-1");

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockMessageRepo.deleteByChatId).toHaveBeenCalledWith("chat-1");
      expect(mockChatRepo.delete).toHaveBeenCalledWith("chat-1");
    });

    it("should throw if chat not found", async () => {
      vi.mocked(mockMessageRepo.deleteByChatId).mockResolvedValue(0);
      vi.mocked(mockChatRepo.delete).mockResolvedValue(false);

      await expect(api.delete("nonexistent")).rejects.toThrow("Chat nonexistent not found");
    });
  });

  describe("sendMessage", () => {
    const chat: Chat = {
      id: "chat-1",
      title: "Test Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
    };

    const existingMessages: Message[] = [
      {
        id: "msg-0",
        chatId: "chat-1",
        role: "user",
        content: "Previous message",
        status: "complete",
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      },
    ];

    async function* mockStreamResponse() {
      yield { content: "Hello", usage: null, finishReason: null };
      yield { content: " world", usage: null, finishReason: null };
      yield { content: "!", usage: { inputTokens: 5, outputTokens: 3 }, finishReason: "stop" };
    }

    it("should create user and assistant messages in transaction", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(existingMessages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const params: SendMessageParams = {
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      const updates: any[] = [];
      for await (const update of stream) {
        updates.push(update);
      }

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockMessageRepo.create).toHaveBeenCalledTimes(2); // user + assistant
    });

    it("should stream AI response", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(existingMessages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const params: SendMessageParams = {
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      const updates: any[] = [];
      for await (const update of stream) {
        updates.push(update);
      }

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[updates.length - 1].status).toBe("complete");
    });

    it("should update assistant message as chunks arrive", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(existingMessages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const params: SendMessageParams = {
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      const updates: any[] = [];
      for await (const update of stream) {
        updates.push(update);
      }

      // Should have streaming updates and final complete
      expect(updates.some(u => u.status === "streaming")).toBe(true);
      expect(updates[updates.length - 1].status).toBe("complete");
    });

    it("should handle streaming errors", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(existingMessages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);

      async function* errorStream() {
        yield { content: "Start", usage: null, finishReason: null };
        throw new Error("Stream error");
      }

      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(errorStream());

      const params: SendMessageParams = {
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);

      try {
        for await (const update of stream) {
          // Consume stream
        }
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toBe("Stream error");
      }

      // Should have marked message as error
      const updates = vi.mocked(mockMessageRepo.update).mock.calls;
      const lastUpdate = updates[updates.length - 1][0];
      expect(lastUpdate.status).toBe("error");
    });

    it("should mark message complete when done", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(existingMessages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const params: SendMessageParams = {
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      let finalUpdate: any;
      for await (const update of stream) {
        finalUpdate = update;
      }

      expect(finalUpdate.status).toBe("complete");
    });

    it("should throw for non-existent chat", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(null);

      const params: SendMessageParams = {
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      await expect(async () => {
        const stream = api.sendMessage("nonexistent", params);
        for await (const update of stream) {
          // Consume stream
        }
      }).rejects.toThrow("Chat nonexistent not found");
    });
  });
});
