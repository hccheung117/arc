import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatsAPI, type TitleUpdatedEvent } from "../src/chats/chats-api.js";
import type { ChatRepository } from "../src/chats/chat-repository.type.js";
import type { MessageRepository } from "../src/messages/message-repository.type.js";
import type { Chat } from "../src/chats/chat.js";
import type { Message } from "../src/messages/message.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { PlatformDatabase } from "@arc/platform";
import type { SettingsAPI } from "../src/settings/settings-api.js";
import { defaultSettings } from "../src/settings/settings.js";

/**
 * ChatsAPI Events Tests
 *
 * Tests the event emission functionality of ChatsAPI,
 * specifically the title-updated event for auto-titling.
 */

describe("ChatsAPI Events", () => {
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

  describe("on and off methods", () => {
    it("should allow subscribing to title-updated event", () => {
      const handler = vi.fn();

      expect(() => {
        api.on("title-updated", handler);
      }).not.toThrow();
    });

    it("should allow unsubscribing from title-updated event", () => {
      const handler = vi.fn();

      api.on("title-updated", handler);

      expect(() => {
        api.off("title-updated", handler);
      }).not.toThrow();
    });
  });

  describe("title-updated event emission", () => {
    it("should emit title-updated event when auto-titling completes", async () => {
      const chatId = "test-chat-id";
      const newTitle = "Python Basics";

      const mockChat: Chat = {
        id: chatId,
        title: "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
      };

      const mockMessages: Message[] = [
        {
          id: "msg-1",
          chatId,
          role: "user",
          content: "How do list comprehensions work in Python?",
          status: "complete",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
        {
          id: "msg-2",
          chatId,
          role: "assistant",
          content: "List comprehensions are a concise way...",
          status: "complete",
          model: "gpt-4",
          providerConnectionId: "provider-1",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
      ];

      vi.mocked(mockChatRepo.findById).mockResolvedValue(mockChat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(mockMessages);
      vi.mocked(mockProvider.generateChatCompletion).mockResolvedValue({
        content: newTitle,
      });

      // Subscribe to event
      const eventHandler = vi.fn();
      api.on("title-updated", eventHandler);

      // Trigger auto-titling by sending a message (which triggers it in background)
      const params = {
        content: "Follow-up question",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      };

      // Mock streaming
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(
        (async function* () {
          yield { content: "Response ", done: false };
          yield { content: "text", done: true };
        })()
      );

      // Send message
      const stream = api.sendMessage(chatId, params);
      for await (const _ of stream) {
        // Consume stream
      }

      // Wait for background auto-titling to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify event was emitted
      expect(eventHandler).toHaveBeenCalledWith({
        chatId,
        title: newTitle,
      });
    });

    it("should call multiple event handlers", async () => {
      const chatId = "test-chat-id";
      const newTitle = "Test Title";

      const mockChat: Chat = {
        id: chatId,
        title: "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
      };

      const mockMessages: Message[] = [
        {
          id: "msg-1",
          chatId,
          role: "user",
          content: "Test message",
          status: "complete",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
        {
          id: "msg-2",
          chatId,
          role: "assistant",
          content: "Response",
          status: "complete",
          model: "gpt-4",
          providerConnectionId: "provider-1",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
      ];

      vi.mocked(mockChatRepo.findById).mockResolvedValue(mockChat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(mockMessages);
      vi.mocked(mockProvider.generateChatCompletion).mockResolvedValue({
        content: newTitle,
      });
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(
        (async function* () {
          yield { content: "Test", done: true };
        })()
      );

      // Subscribe multiple handlers
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      api.on("title-updated", handler1);
      api.on("title-updated", handler2);

      // Send message to trigger auto-titling
      const stream = api.sendMessage(chatId, {
        content: "Test",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      });
      for await (const _ of stream) {
        // Consume stream
      }

      // Wait for background process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Both handlers should be called
      expect(handler1).toHaveBeenCalledWith({ chatId, title: newTitle });
      expect(handler2).toHaveBeenCalledWith({ chatId, title: newTitle });
    });

    it("should not emit event after handler is unsubscribed", async () => {
      const chatId = "test-chat-id";
      const newTitle = "Test Title";

      const mockChat: Chat = {
        id: chatId,
        title: "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
      };

      const mockMessages: Message[] = [
        {
          id: "msg-1",
          chatId,
          role: "user",
          content: "Test",
          status: "complete",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
        {
          id: "msg-2",
          chatId,
          role: "assistant",
          content: "Response",
          status: "complete",
          model: "gpt-4",
          providerConnectionId: "provider-1",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
      ];

      vi.mocked(mockChatRepo.findById).mockResolvedValue(mockChat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(mockMessages);
      vi.mocked(mockProvider.generateChatCompletion).mockResolvedValue({
        content: newTitle,
      });
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(
        (async function* () {
          yield { content: "Test", done: true };
        })()
      );

      const handler = vi.fn();
      api.on("title-updated", handler);
      api.off("title-updated", handler);

      // Send message
      const stream = api.sendMessage(chatId, {
        content: "Test",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      });
      for await (const _ of stream) {
        // Consume stream
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });

    it("should not emit event when auto-titling is disabled", async () => {
      const chatId = "test-chat-id";

      // Mock settings with auto-titling disabled
      vi.mocked(mockSettingsAPI.get).mockResolvedValue({
        ...defaultSettings,
        autoTitleChats: false,
      });

      const mockChat: Chat = {
        id: chatId,
        title: "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
      };

      const mockMessages: Message[] = [
        {
          id: "msg-1",
          chatId,
          role: "user",
          content: "Test",
          status: "complete",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
        {
          id: "msg-2",
          chatId,
          role: "assistant",
          content: "Response",
          status: "complete",
          model: "gpt-4",
          providerConnectionId: "provider-1",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
      ];

      vi.mocked(mockChatRepo.findById).mockResolvedValue(mockChat);
      vi.mocked(mockMessageRepo.findByChatId).mockResolvedValue(mockMessages);
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(
        (async function* () {
          yield { content: "Test", done: true };
        })()
      );

      const handler = vi.fn();
      api.on("title-updated", handler);

      // Send message
      const stream = api.sendMessage(chatId, {
        content: "Test",
        model: "gpt-4",
        providerConnectionId: "provider-1",
      });
      for await (const _ of stream) {
        // Consume stream
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Event should not be emitted
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
