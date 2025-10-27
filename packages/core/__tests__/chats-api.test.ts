import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatsAPI, type SendMessageParams } from "../src/chats/chats-api.js";
import type { ChatRepository } from "../src/chats/chat-repository.type.js";
import type { MessageRepository } from "../src/messages/message-repository.type.js";
import type { Chat } from "../src/chats/chat.js";
import type { Message } from "../src/messages/message.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { PlatformDatabase } from "@arc/platform";
import type { SettingsAPI } from "../src/settings/settings-api.js";
import { defaultSettings } from "../src/settings/settings.js";

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
  let mockSettingsAPI: SettingsAPI;

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

    mockSettingsAPI = {
      get: vi.fn(async () => ({ ...defaultSettings, autoTitleChats: true })),
      update: vi.fn(),
      reset: vi.fn(),
    } as unknown as SettingsAPI;

    api = new ChatsAPI(
      mockChatRepo,
      mockMessageRepo,
      mockDb,
      mockGetProvider,
      undefined,
      mockSettingsAPI
    );
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

    describe("advanced options (Phase 8)", () => {
      it("should store temperature on assistant message", async () => {
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
          options: {
            temperature: 0.7,
          },
        };

        const stream = api.sendMessage("chat-1", params);
        for await (const update of stream) {
          // Consume stream
        }

        // Find the assistant message creation call
        const createCalls = vi.mocked(mockMessageRepo.create).mock.calls;
        const assistantMessage = createCalls.find(call => call[0].role === "assistant")?.[0];
        expect(assistantMessage?.temperature).toBe(0.7);
      });

      it("should store systemPrompt on assistant message", async () => {
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
          options: {
            systemPrompt: "You are a helpful assistant.",
          },
        };

        const stream = api.sendMessage("chat-1", params);
        for await (const update of stream) {
          // Consume stream
        }

        // Find the assistant message creation call
        const createCalls = vi.mocked(mockMessageRepo.create).mock.calls;
        const assistantMessage = createCalls.find(call => call[0].role === "assistant")?.[0];
        expect(assistantMessage?.systemPrompt).toBe("You are a helpful assistant.");
      });

      it("should pass temperature to provider.streamChatCompletion", async () => {
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
          options: {
            temperature: 0.9,
          },
        };

        const stream = api.sendMessage("chat-1", params);
        for await (const update of stream) {
          // Consume stream
        }

        expect(mockProvider.streamChatCompletion).toHaveBeenCalledWith(
          expect.anything(),
          "gpt-4",
          expect.objectContaining({
            temperature: 0.9,
          })
        );
      });

      it("should pass systemPrompt to provider.streamChatCompletion", async () => {
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
          options: {
            systemPrompt: "Be concise.",
          },
        };

        const stream = api.sendMessage("chat-1", params);
        for await (const update of stream) {
          // Consume stream
        }

        expect(mockProvider.streamChatCompletion).toHaveBeenCalledWith(
          expect.anything(),
          "gpt-4",
          expect.objectContaining({
            systemPrompt: "Be concise.",
          })
        );
      });
    });
  });

  describe("branch (Phase 8)", () => {
    const sourceChat: Chat = {
      id: "chat-1",
      title: "Original Chat",
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 5000,
      lastMessageAt: Date.now() - 1000,
    };

    const messages: Message[] = [
      {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        content: "Message 1",
        status: "complete",
        createdAt: Date.now() - 9000,
        updatedAt: Date.now() - 9000,
      },
      {
        id: "msg-2",
        chatId: "chat-1",
        role: "assistant",
        content: "Response 1",
        status: "complete",
        createdAt: Date.now() - 8000,
        updatedAt: Date.now() - 8000,
      },
      {
        id: "msg-3",
        chatId: "chat-1",
        role: "user",
        content: "Message 2",
        status: "complete",
        createdAt: Date.now() - 7000,
        updatedAt: Date.now() - 7000,
      },
      {
        id: "msg-4",
        chatId: "chat-1",
        role: "assistant",
        content: "Response 2",
        status: "complete",
        createdAt: Date.now() - 6000,
        updatedAt: Date.now() - 6000,
      },
    ];

    it("should create new chat with correct title suffix", async () => {
      vi.mocked(mockChatRepo.findById).mockImplementation(async (id) => {
        if (id === "chat-1") return sourceChat;
        return {
          id,
          title: "Original Chat (Branch)",
          parentChatId: "chat-1",
          parentMessageId: "msg-2",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        };
      });
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(messages[1]);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockChatRepo.create).mockImplementation(async (chat) => chat);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);

      const result = await api.branch("chat-1", "msg-2");

      expect(result.title).toBe("Original Chat (Branch)");
    });

    it("should set parentChatId and parentMessageId correctly", async () => {
      vi.mocked(mockChatRepo.findById).mockImplementation(async (id) => {
        if (id === "chat-1") return sourceChat;
        return {
          id,
          title: "Original Chat (Branch)",
          parentChatId: "chat-1",
          parentMessageId: "msg-2",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        };
      });
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(messages[1]);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockChatRepo.create).mockImplementation(async (chat) => chat);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);

      const result = await api.branch("chat-1", "msg-2");

      expect(result.parentChatId).toBe("chat-1");
      expect(result.parentMessageId).toBe("msg-2");
    });

    it("should copy all messages up to and including branch point", async () => {
      vi.mocked(mockChatRepo.findById).mockImplementation(async (id) => {
        if (id === "chat-1") return sourceChat;
        return {
          id,
          title: "Original Chat (Branch)",
          parentChatId: "chat-1",
          parentMessageId: "msg-2",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        };
      });
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(messages[1]);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockChatRepo.create).mockImplementation(async (chat) => chat);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);

      await api.branch("chat-1", "msg-2");

      // Should create 2 messages (msg-1 and msg-2, not msg-3 and msg-4)
      expect(mockMessageRepo.create).toHaveBeenCalledTimes(2);
    });

    it("should generate new IDs for chat and all copied messages", async () => {
      vi.mocked(mockChatRepo.findById).mockImplementation(async (id) => {
        if (id === "chat-1") return sourceChat;
        return {
          id,
          title: "Original Chat (Branch)",
          parentChatId: "chat-1",
          parentMessageId: "msg-2",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        };
      });
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(messages[1]);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockChatRepo.create).mockImplementation(async (chat) => chat);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);

      await api.branch("chat-1", "msg-2");

      // Check that created chat has new ID
      const chatCreateCall = vi.mocked(mockChatRepo.create).mock.calls[0][0];
      expect(chatCreateCall.id).not.toBe("chat-1");

      // Check that created messages have new IDs
      const messageCreateCalls = vi.mocked(mockMessageRepo.create).mock.calls;
      expect(messageCreateCalls[0][0].id).not.toBe("msg-1");
      expect(messageCreateCalls[1][0].id).not.toBe("msg-2");
    });

    it("should execute atomically (transaction)", async () => {
      vi.mocked(mockChatRepo.findById).mockImplementation(async (id) => {
        if (id === "chat-1") return sourceChat;
        return {
          id,
          title: "Original Chat (Branch)",
          parentChatId: "chat-1",
          parentMessageId: "msg-2",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
        };
      });
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(messages[1]);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockChatRepo.create).mockImplementation(async (chat) => chat);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);

      await api.branch("chat-1", "msg-2");

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should throw for non-existent source chat", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(null);

      await expect(api.branch("nonexistent", "msg-2")).rejects.toThrow(
        "Chat nonexistent not found"
      );
    });

    it("should throw for non-existent message", async () => {
      vi.mocked(mockChatRepo.findById).mockResolvedValue(sourceChat);
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(null);

      await expect(api.branch("chat-1", "nonexistent")).rejects.toThrow(
        "Message nonexistent not found in chat chat-1"
      );
    });

    it("should throw for message not in specified chat", async () => {
      const wrongMessage: Message = {
        ...messages[1],
        chatId: "wrong-chat",
      };

      vi.mocked(mockChatRepo.findById).mockResolvedValue(sourceChat);
      vi.mocked(mockMessageRepo.findById).mockResolvedValue(wrongMessage);

      await expect(api.branch("chat-1", "msg-2")).rejects.toThrow(
        "Message msg-2 not found in chat chat-1"
      );
    });
  });

  describe("auto-titling (Phase 8 Remediation)", () => {
    // Helper function to create fresh chat and messages for each test
    const createFreshChat = (): Chat => ({
      id: "chat-1",
      title: "New Chat",
      createdAt: Date.now() - 5000,
      updatedAt: Date.now() - 5000,
      lastMessageAt: Date.now() - 1000,
    });

    const createFreshMessages = (): Message[] => [
      {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        content: "Hello, can you help me?",
        status: "complete",
        createdAt: Date.now() - 4000,
        updatedAt: Date.now() - 4000,
      },
      {
        id: "msg-2",
        chatId: "chat-1",
        role: "assistant",
        content: "Of course! How can I assist you?",
        model: "gpt-4",
        providerConnectionId: "provider-1",
        status: "complete",
        createdAt: Date.now() - 3000,
        updatedAt: Date.now() - 3000,
      },
    ];

    async function* mockStreamResponse() {
      yield { content: "Test", usage: null, finishReason: null };
      yield { content: " response", usage: null, finishReason: null };
      yield { content: "!", usage: { inputTokens: 5, outputTokens: 3 }, finishReason: "stop" };
    }

    beforeEach(() => {
      // Reset all mocks to prevent interference between tests
      vi.mocked(mockProvider.generateChatCompletion).mockReset();
      vi.mocked(mockProvider.streamChatCompletion).mockReset();
      vi.mocked(mockChatRepo.findById).mockReset();
      vi.mocked(mockMessageRepo.findByChatId).mockReset();
      vi.mocked(mockChatRepo.update).mockReset();
    });

    it("should trigger auto-title generation after first exchange when title is 'New Chat'", async () => {
      const chat = createFreshChat();
      const messages = createFreshMessages();
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      vi.mocked(mockProvider.generateChatCompletion).mockResolvedValue({
        content: "Help Request",
        metadata: { model: "gpt-4", provider: "openai" },
      });
      vi.mocked(mockSettingsAPI.get).mockResolvedValue({ ...defaultSettings, autoTitleChats: true });

      const params: SendMessageParams = {
        content: "Another question",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      for await (const update of stream) {
        // Consume stream
      }

      // Wait for background auto-titling to complete before next test
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockProvider.generateChatCompletion).toHaveBeenCalledOnce();
      expect(mockChatRepo.update).toHaveBeenCalled();

      const updateCalls = vi.mocked(mockChatRepo.update).mock.calls;
      const titleUpdate = updateCalls.find(call => call[0].title === "Help Request");
      expect(titleUpdate).toBeDefined();
    });

    it("should skip auto-titling when autoTitleChats setting is false", async () => {
      const chat = createFreshChat();
      const messages = createFreshMessages();
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      vi.mocked(mockSettingsAPI.get).mockResolvedValue({ ...defaultSettings, autoTitleChats: false });

      const params: SendMessageParams = {
        content: "Another question",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      for await (const update of stream) {
        // Consume stream
      }

      // Wait to ensure no background titling occurs
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockProvider.generateChatCompletion).not.toHaveBeenCalled();
    });

    it("should skip auto-titling when chat already has custom title", async () => {
      const chat = createFreshChat();
      const messages = createFreshMessages();
      const customChat: Chat = {
        ...chat,
        title: "My Custom Chat",
      };

      vi.mocked(mockChatRepo.findById).mockResolvedValue(customChat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      vi.mocked(mockSettingsAPI.get).mockResolvedValue({ ...defaultSettings, autoTitleChats: true });

      const params: SendMessageParams = {
        content: "Another question",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      for await (const update of stream) {
        // Consume stream
      }

      // Wait to ensure no background titling occurs
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockProvider.generateChatCompletion).not.toHaveBeenCalled();
    });

    it("should complete sendMessage successfully even if auto-titling fails", async () => {
      const chat = createFreshChat();
      const messages = createFreshMessages();
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      vi.mocked(mockProvider.generateChatCompletion).mockRejectedValue(new Error("Title generation failed"));
      vi.mocked(mockSettingsAPI.get).mockResolvedValue({ ...defaultSettings, autoTitleChats: true });

      const params: SendMessageParams = {
        content: "Another question",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      let finalUpdate: any;

      // Should not throw
      for await (const update of stream) {
        finalUpdate = update;
      }

      expect(finalUpdate.status).toBe("complete");
    });

    it("should skip auto-titling when chat has fewer than 2 messages", async () => {
      const chat = createFreshChat();
      const messages = createFreshMessages();
      const singleMessage: Message[] = [messages[0]];

      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(singleMessage);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      vi.mocked(mockSettingsAPI.get).mockResolvedValue({ ...defaultSettings, autoTitleChats: true });

      const params: SendMessageParams = {
        content: "First message",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      for await (const update of stream) {
        // Consume stream
      }

      // Wait to ensure no background titling occurs
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockProvider.generateChatCompletion).not.toHaveBeenCalled();
    });

    it("should clean up generated title (remove quotes, trim, limit length)", async () => {
      const chat = createFreshChat();
      const messages = createFreshMessages();
      vi.mocked(mockChatRepo.findById).mockResolvedValue(chat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(messages);
      vi.mocked(mockMessageRepo.create).mockImplementation(async (msg) => msg);
      vi.mocked(mockMessageRepo.update).mockImplementation(async (msg) => msg);
      vi.mocked(mockChatRepo.update).mockImplementation(async (c) => c);
      // Use mockImplementation to return a fresh generator each time
      vi.mocked(mockProvider.streamChatCompletion).mockImplementation(() => mockStreamResponse());
      vi.mocked(mockProvider.generateChatCompletion).mockResolvedValue({
        content: '  "My Title"  ',
        metadata: { model: "gpt-4", provider: "openai" },
      });
      vi.mocked(mockSettingsAPI.get).mockResolvedValue({ ...defaultSettings, autoTitleChats: true });

      const params: SendMessageParams = {
        content: "Another question",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      const stream = api.sendMessage("chat-1", params);
      for await (const update of stream) {
        // Consume stream
      }

      // Wait for background auto-titling to complete (longer timeout to ensure previous tests' async ops finish)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Debug: Check how many times generateChatCompletion was called
      expect(mockProvider.generateChatCompletion).toHaveBeenCalledTimes(1);

      // Check that the title was cleaned
      const updateCalls = vi.mocked(mockChatRepo.update).mock.calls;
      const titleUpdate = updateCalls.find(call => call[0].title !== "New Chat");
      expect(titleUpdate).toBeDefined();
      expect(titleUpdate[0].title).toBe("My Title");
    });
  });
});
