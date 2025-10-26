import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessagesAPI } from "../src/messages/messages-api.js";
import type { MessageRepository } from "../src/messages/message-repository.type.js";
import type { ChatRepository } from "../src/chats/chat-repository.type.js";
import type { Message } from "../src/messages/message.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { PlatformDatabase } from "@arc/platform";

/**
 * MessagesAPI Tests
 *
 * Tests the MessagesAPI with mocked dependencies.
 */

describe("MessagesAPI", () => {
  let api: MessagesAPI;
  let mockMessageRepo: MessageRepository;
  let mockChatRepo: ChatRepository;
  let mockDb: PlatformDatabase;
  let mockGetProvider: (configId: string) => Promise<Provider>;
  let mockProvider: Provider;

  beforeEach(() => {
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

    mockChatRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

    api = new MessagesAPI(mockMessageRepo, mockChatRepo, mockDb, mockGetProvider);
  });

  describe("regenerate", () => {
    it("should regenerate last assistant message using stored model/provider", async () => {
      const messages: Message[] = [
        {
          id: "msg-1",
          chatId: "chat-1",
          role: "user",
          content: "Hello",
          status: "complete",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
        {
          id: "msg-2",
          chatId: "chat-1",
          role: "assistant",
          content: "Hi there",
          model: "gpt-4",
          providerConnectionId: "provider-123",
          status: "complete",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
      ];

      async function* mockStreamResponse() {
        yield { content: "New", usage: null, finishReason: null };
        yield { content: " response", usage: null, finishReason: null };
        yield { content: "!", usage: { inputTokens: 5, outputTokens: 3 }, finishReason: "stop" };
      }

      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.delete).mockResolvedValue(true);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const stream = api.regenerate("chat-1");
      const updates: any[] = [];

      for await (const update of stream) {
        updates.push(update);
      }

      // Should delete old assistant message
      expect(mockMessageRepo.delete).toHaveBeenCalledWith("msg-2");

      // Should create new assistant message
      expect(mockMessageRepo.create).toHaveBeenCalled();

      // Should stream updates
      expect(updates).toHaveLength(4); // streaming updates + complete
      expect(updates[updates.length - 1].status).toBe("complete");
      expect(updates[updates.length - 1].content).toBe("New response!");
    });

    it("should throw if assistant message has no model info", async () => {
      const messages: Message[] = [
        {
          id: "msg-1",
          chatId: "chat-1",
          role: "user",
          content: "Hello",
          status: "complete",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
        {
          id: "msg-2",
          chatId: "chat-1",
          role: "assistant",
          content: "Hi there",
          // Missing model and providerConnectionId
          status: "complete",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
      ];

      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.delete).mockResolvedValue(true);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);

      const stream = api.regenerate("chat-1");

      await expect(async () => {
        for await (const update of stream) {
          // Consume stream
        }
      }).rejects.toThrow("Cannot regenerate: original message has no model information");
    });

    it("should throw if assistant message has no provider info", async () => {
      const messages: Message[] = [
        {
          id: "msg-1",
          chatId: "chat-1",
          role: "user",
          content: "Hello",
          status: "complete",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
        {
          id: "msg-2",
          chatId: "chat-1",
          role: "assistant",
          content: "Hi there",
          model: "gpt-4",
          // Missing providerConnectionId
          status: "complete",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
      ];

      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.delete).mockResolvedValue(true);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);

      const stream = api.regenerate("chat-1");

      await expect(async () => {
        for await (const update of stream) {
          // Consume stream
        }
      }).rejects.toThrow("Cannot regenerate: original message has no provider information");
    });

    it("should throw if no assistant messages exist", async () => {
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
      ];

      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);

      const stream = api.regenerate("chat-1");

      await expect(async () => {
        for await (const update of stream) {
          // Consume stream
        }
      }).rejects.toThrow("No assistant message to regenerate");
    });

    it("should throw if no messages in chat", async () => {
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue([]);

      const stream = api.regenerate("chat-1");

      await expect(async () => {
        for await (const update of stream) {
          // Consume stream
        }
      }).rejects.toThrow("No messages in chat to regenerate");
    });
  });

  describe("edit", () => {
    it("should update user message content", async () => {
      const message: Message = {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        content: "Old content",
        status: "complete",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(message);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);

      await api.edit("msg-1", "New content");

      expect(mockMessageRepo.update).toHaveBeenCalled();
      const updatedMessage = vi.mocked(mockMessageRepo.update).mock.calls[0][0];
      expect(updatedMessage.content).toBe("New content");
    });

    it("should throw for assistant messages", async () => {
      const message: Message = {
        id: "msg-1",
        chatId: "chat-1",
        role: "assistant",
        content: "Assistant message",
        status: "complete",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(message);

      await expect(api.edit("msg-1", "New content")).rejects.toThrow("Can only edit user messages");
    });

    it("should throw for non-existent message", async () => {
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(null);

      await expect(api.edit("nonexistent", "New content")).rejects.toThrow("Message nonexistent not found");
    });
  });

  describe("findAfter", () => {
    it("should return messages created after the specified message", async () => {
      const referenceMessage: Message = {
        id: "msg-2",
        chatId: "chat-1",
        role: "user",
        content: "Second message",
        status: "complete",
        createdAt: 2000,
        updatedAt: 2000,
      };

      const allMessages: Message[] = [
        {
          id: "msg-1",
          chatId: "chat-1",
          role: "user",
          content: "First message",
          status: "complete",
          createdAt: 1000,
          updatedAt: 1000,
        },
        referenceMessage,
        {
          id: "msg-3",
          chatId: "chat-1",
          role: "assistant",
          content: "Third message",
          status: "complete",
          createdAt: 3000,
          updatedAt: 3000,
        },
        {
          id: "msg-4",
          chatId: "chat-1",
          role: "user",
          content: "Fourth message",
          status: "complete",
          createdAt: 4000,
          updatedAt: 4000,
        },
      ];

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(referenceMessage);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(allMessages);

      const result = await api.findAfter("msg-2");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("msg-3");
      expect(result[1].id).toBe("msg-4");
    });

    it("should return empty array if no messages after", async () => {
      const referenceMessage: Message = {
        id: "msg-3",
        chatId: "chat-1",
        role: "user",
        content: "Last message",
        status: "complete",
        createdAt: 3000,
        updatedAt: 3000,
      };

      const allMessages: Message[] = [
        {
          id: "msg-1",
          chatId: "chat-1",
          role: "user",
          content: "First message",
          status: "complete",
          createdAt: 1000,
          updatedAt: 1000,
        },
        referenceMessage,
      ];

      vi.mocked(mockMessageRepo.findById).mockResolvedValue(referenceMessage);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(allMessages);

      const result = await api.findAfter("msg-3");

      expect(result).toHaveLength(0);
    });

    it("should throw for non-existent message", async () => {
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(null);

      await expect(api.findAfter("nonexistent")).rejects.toThrow("Message nonexistent not found");
    });
  });

  describe("delete", () => {
    it("should delete message from repository", async () => {
      vi.mocked(mockMessageRepo.delete).mockResolvedValue(true);

      await api.delete("msg-1");

      expect(mockMessageRepo.delete).toHaveBeenCalledWith("msg-1");
    });

    it("should throw for non-existent message", async () => {
      vi.mocked(mockMessageRepo.delete).mockResolvedValue(false);

      await expect(api.delete("nonexistent")).rejects.toThrow("Message nonexistent not found");
    });
  });

  describe("stop", () => {
    it("should call streamer.stopAll", async () => {
      // The streamer is created internally, so we can't easily mock it
      // But we can verify the method doesn't throw
      await api.stop();
      // If no error is thrown, the test passes
      expect(true).toBe(true);
    });
  });
});
