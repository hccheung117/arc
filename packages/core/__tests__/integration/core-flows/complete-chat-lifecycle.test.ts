/**
 * Complete Chat Lifecycle Integration Test
 *
 * Tests the entire user journey from provider creation to chat deletion.
 * This is the primary integration test that validates the system works end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";
import { createMockProvider } from "../fixtures/mock-provider.js";

describe("Integration: Complete Chat Lifecycle", () => {
  let core: Core;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const context = await createIntegrationTestCore(
      createMockProvider({ response: "Hello! How can I help you today?" })
    );
    core = context.core;
    cleanup = context.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should complete full chat lifecycle from creation to deletion", async () => {
    // Step 1: Create a provider connection
    const provider = await createTestProviderConfig(core, {
      name: "My Test Provider",
      type: "openai",
    });

    expect(provider.id).toBeDefined();
    expect(provider.name).toBe("My Test Provider");
    expect(provider.enabled).toBe(true);

    // Verify provider is in the list
    const providers = await core.providers.list();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe(provider.id);

    // Step 2: Start a PendingChat
    const pendingChat = core.chats.create({ title: "Integration Test Chat" });

    expect(pendingChat.id).toBeDefined();
    expect(pendingChat.title).toBe("Integration Test Chat");

    // Step 3: Send the first message (persists the chat)
    const firstMessageStream = pendingChat.send({
      content: "Hello, can you help me?",
      model: "gpt-4",
      providerConnectionId: provider.id,
    });

    const firstResult = await consumeStreamLast(firstMessageStream);
    expect(firstResult).toBeDefined();
    expect(firstResult?.status).toBe("complete");

    // Step 4: Verify chat and messages in database
    const chatWithMessages = await core.chats.get(pendingChat.id);

    expect(chatWithMessages).not.toBeNull();
    expect(chatWithMessages?.chat.id).toBe(pendingChat.id);
    expect(chatWithMessages?.chat.title).toBe("Integration Test Chat");
    expect(chatWithMessages?.messages).toHaveLength(2); // user + assistant

    const [userMessage, assistantMessage] = chatWithMessages!.messages;

    // User messages don't have model/provider - those are set on assistant responses
    expect(userMessage.role).toBe("user");
    expect(userMessage.content).toBe("Hello, can you help me?");
    expect(userMessage.status).toBe("complete");

    // Assistant message should have model and provider info
    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.content).toBe("Mock AI response!");
    expect(assistantMessage.status).toBe("complete");
    expect(assistantMessage.model).toBe("gpt-4");
    expect(assistantMessage.providerConnectionId).toBe(provider.id);

    // Step 5: Continue the conversation with sendMessage
    const secondMessageStream = core.chats.sendMessage(pendingChat.id, {
      content: "Tell me about integration testing",
      model: "gpt-4",
      providerConnectionId: provider.id,
    });

    const secondResult = await consumeStreamLast(secondMessageStream);
    expect(secondResult?.status).toBe("complete");

    // Verify we now have 4 messages
    const updatedChat = await core.chats.get(pendingChat.id);
    expect(updatedChat?.messages).toHaveLength(4);

    // Step 6: Search for a term within messages
    const searchResults = await core.search.messages("help");

    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some(result => result.message.content.includes("help"))).toBe(true);

    // Search within specific chat
    const chatSearchResults = await core.search.messagesInChat(pendingChat.id, "testing");

    expect(chatSearchResults.length).toBeGreaterThan(0);
    expect(chatSearchResults.every(result => result.chatId === pendingChat.id)).toBe(true);

    // Step 7: Rename the chat
    await core.chats.rename(pendingChat.id, "Renamed Integration Chat");

    const renamedChat = await core.chats.get(pendingChat.id);
    expect(renamedChat?.chat.title).toBe("Renamed Integration Chat");

    // Verify chat appears in list with new name
    const chats = await core.chats.list();
    expect(chats.find(c => c.id === pendingChat.id)?.title).toBe("Renamed Integration Chat");

    // Step 8: Delete the chat and verify cascade deletion
    await core.chats.delete(pendingChat.id);

    // Verify chat is deleted
    const deletedChat = await core.chats.get(pendingChat.id);
    expect(deletedChat).toBeNull();

    // Verify chat not in list
    const finalChats = await core.chats.list();
    expect(finalChats.find(c => c.id === pendingChat.id)).toBeUndefined();

    // Verify messages are cascade deleted (search should return no results)
    const postDeleteSearch = await core.search.messagesInChat(pendingChat.id, "help");
    expect(postDeleteSearch).toHaveLength(0);
  });
});
