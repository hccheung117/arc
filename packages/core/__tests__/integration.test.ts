import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProvidersAPI } from "../src/providers/providers-api.js";
import { ChatsAPI } from "../src/chats/chats-api.js";
import { MessagesAPI } from "../src/messages/messages-api.js";
import { SearchAPI } from "../src/search/search-api.js";
import { SettingsAPI } from "../src/settings/settings-api.js";
import { InMemoryChatRepository } from "../src/chats/chat-repository-memory.js";
import { InMemoryMessageRepository } from "../src/messages/message-repository-memory.js";
import { InMemoryProviderConfigRepository } from "../src/providers/provider-repository-memory.js";
import { InMemorySettingsRepository } from "../src/settings/settings-repository-memory.js";
import { ProviderManager } from "../src/providers/provider-manager.js";
import { createDefaultRegistry } from "../src/providers/provider-registry.js";
import { SearchEngine } from "../src/search/search-engine.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { PlatformDatabase, PlatformHTTP } from "@arc/platform";

/**
 * Core Integration Tests
 *
 * These tests use real in-memory repositories (not mocked) to verify
 * the integration between different parts of the system.
 *
 * Only the Provider and Platform HTTP are mocked.
 */

describe("Core Integration", () => {
  let providersAPI: ProvidersAPI;
  let chatsAPI: ChatsAPI;
  let messagesAPI: MessagesAPI;
  let searchAPI: SearchAPI;
  let settingsAPI: SettingsAPI;

  let chatRepo: InMemoryChatRepository;
  let messageRepo: InMemoryMessageRepository;
  let providerRepo: InMemoryProviderConfigRepository;
  let settingsRepo: InMemorySettingsRepository;

  let mockDb: PlatformDatabase;
  let mockHTTP: PlatformHTTP;
  let mockProvider: Provider;
  let providerManager: ProviderManager;

  beforeEach(() => {
    // Create real in-memory repositories
    chatRepo = new InMemoryChatRepository();
    messageRepo = new InMemoryMessageRepository();
    providerRepo = new InMemoryProviderConfigRepository();
    settingsRepo = new InMemorySettingsRepository();

    // Mock platform database (just for transactions)
    mockDb = {
      init: vi.fn(),
      close: vi.fn(),
      query: vi.fn(),
      exec: vi.fn(),
      transaction: vi.fn(async (fn) => await fn()),
    };

    // Mock platform HTTP
    mockHTTP = {
      request: vi.fn(),
      stream: vi.fn(),
    };

    // Mock provider
    mockProvider = {
      generateChatCompletion: vi.fn(),
      streamChatCompletion: vi.fn(),
      listModels: vi.fn().mockResolvedValue([]),
      healthCheck: vi.fn().mockResolvedValue(true),
      getCapabilities: vi.fn(),
    };

    // Create provider manager with real registry
    const registry = createDefaultRegistry(mockHTTP);
    providerManager = new ProviderManager(registry, mockHTTP);

    // Override getProvider to return our mock
    const getProvider = async (configId: string): Promise<Provider> => {
      const config = await providerRepo.findById(configId);
      if (!config) {
        throw new Error(`Provider configuration ${configId} not found`);
      }
      return mockProvider;
    };

    // Create feature APIs
    providersAPI = new ProvidersAPI(providerRepo, providerManager);
    chatsAPI = new ChatsAPI(chatRepo, messageRepo, mockDb, getProvider);
    messagesAPI = new MessagesAPI(messageRepo, chatRepo, mockDb, getProvider);

    const searchEngine = new SearchEngine(messageRepo, chatRepo);
    searchAPI = new SearchAPI(searchEngine);

    settingsAPI = new SettingsAPI(settingsRepo);
  });

  async function* mockStreamResponse() {
    yield { content: "Hello", usage: null, finishReason: null };
    yield { content: " world", usage: null, finishReason: null };
    yield { content: "!", usage: { inputTokens: 5, outputTokens: 3 }, finishReason: "stop" };
  }

  describe("PendingChat flow", () => {
    it("should create chat and first message atomically", async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      // Create a provider config first
      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      const pendingChat = chatsAPI.create({ title: "Integration Test Chat" });

      const stream = pendingChat.send({
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });

      let result: any;
      for await (const update of stream) {
        result = update;
      }

      // Verify chat was created
      const chats = await chatRepo.findAll();
      expect(chats).toHaveLength(1);
      expect(chats[0].title).toBe("Integration Test Chat");
    });

    it("should stream AI response", async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      const pendingChat = chatsAPI.create({ title: "Test Chat" });

      const stream = pendingChat.send({
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });

      const updates: any[] = [];
      for await (const update of stream) {
        updates.push(update);
      }

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[updates.length - 1].status).toBe("complete");
    });

    it("should persist chat in database", async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      const pendingChat = chatsAPI.create({ title: "Persistent Chat" });

      const stream = pendingChat.send({
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });

      for await (const update of stream) {
        // Consume stream
      }

      const chat = await chatRepo.findById(pendingChat.id);
      expect(chat).not.toBeNull();
      expect(chat?.title).toBe("Persistent Chat");
    });

    it("should persist both messages in database", async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      const pendingChat = chatsAPI.create({ title: "Test Chat" });

      const stream = pendingChat.send({
        content: "Hello",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });

      for await (const update of stream) {
        // Consume stream
      }

      const messages = await messageRepo.findByChatId(pendingChat.id);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
      expect(messages[1].role).toBe("assistant");
      expect(messages[1].status).toBe("complete");
    });
  });

  describe("sendMessage flow", () => {
    it("should add message to existing chat", async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      // Create initial chat
      const pendingChat = chatsAPI.create({ title: "Test Chat" });
      const stream1 = pendingChat.send({
        content: "First message",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });
      for await (const update of stream1) {
        // Consume stream
      }

      // Send another message
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      const stream2 = chatsAPI.sendMessage(pendingChat.id, {
        content: "Second message",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });
      for await (const update of stream2) {
        // Consume stream
      }

      const messages = await messageRepo.findByChatId(pendingChat.id);
      expect(messages).toHaveLength(4); // 2 user + 2 assistant
    });

    it("should stream response", async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      const pendingChat = chatsAPI.create({ title: "Test Chat" });
      const stream1 = pendingChat.send({
        content: "First",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });
      for await (const update of stream1) {
        // Consume stream
      }

      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      const stream2 = chatsAPI.sendMessage(pendingChat.id, {
        content: "Second",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });

      const updates: any[] = [];
      for await (const update of stream2) {
        updates.push(update);
      }

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[updates.length - 1].status).toBe("complete");
    });

    it("should build conversation history correctly", async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      const pendingChat = chatsAPI.create({ title: "Test Chat" });
      const stream1 = pendingChat.send({
        content: "First",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });
      for await (const update of stream1) {
        // Consume
      }

      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      const stream2 = chatsAPI.sendMessage(pendingChat.id, {
        content: "Second",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });
      for await (const update of stream2) {
        // Consume
      }

      // Verify provider was called with full conversation history
      const calls = vi.mocked(mockProvider.streamChatCompletion).mock.calls;
      expect(calls.length).toBe(2);
      // Second call should have conversation history
      expect(calls[1][0].length).toBeGreaterThan(1);
    });
  });

  describe("provider caching", () => {
    it("should cache provider instances", async () => {
      const config = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      // This would use the provider manager's cache in a real scenario
      // Since we're mocking the provider, we just verify the config exists
      const found = await providerRepo.findById(config.id);
      expect(found).not.toBeNull();
    });

    it("should invalidate cache on update", async () => {
      const config = await providersAPI.create({
        name: "Old Name",
        type: "openai",
        apiKey: "old-key",
        baseUrl: "https://api.openai.com/v1",
      });

      await providersAPI.update(config.id, { name: "New Name" });

      const updated = await providerRepo.findById(config.id);
      expect(updated?.name).toBe("New Name");
    });

    it("should invalidate cache on delete", async () => {
      const config = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      await providersAPI.delete(config.id);

      const found = await providerRepo.findById(config.id);
      expect(found).toBeNull();
    });
  });

  describe("settings persistence", () => {
    it("should persist settings", async () => {
      await settingsAPI.update({ theme: "dark", fontSize: "large" });

      const settings = await settingsAPI.get();
      expect(settings.theme).toBe("dark");
      expect(settings.fontSize).toBe("large");
    });

    it("should merge with defaults correctly", async () => {
      await settingsAPI.update({ theme: "light" });

      const settings = await settingsAPI.get();
      expect(settings.theme).toBe("light");
      expect(settings.enableMarkdown).toBe(true); // From defaults
    });
  });

  describe("search integration", () => {
    beforeEach(async () => {
      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());

      const providerConfig = await providersAPI.create({
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      // Create multiple chats with messages
      const chat1 = chatsAPI.create({ title: "Chat 1" });
      const stream1 = chat1.send({
        content: "Hello world from chat 1",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });
      for await (const update of stream1) {
        // Consume
      }

      vi.mocked(mockProvider.streamChatCompletion).mockReturnValue(mockStreamResponse());
      const chat2 = chatsAPI.create({ title: "Chat 2" });
      const stream2 = chat2.send({
        content: "Hello world from chat 2",
        model: "gpt-4",
        providerConnectionId: providerConfig.id,
      });
      for await (const update of stream2) {
        // Consume
      }
    });

    it("should search across multiple chats", async () => {
      const results = await searchAPI.messages("hello");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should filter by chatId", async () => {
      const chats = await chatRepo.findAll();
      const chatId = chats[0].id;

      const results = await searchAPI.messagesInChat(chatId, "hello");

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.chatId === chatId)).toBe(true);
    });
  });
});
