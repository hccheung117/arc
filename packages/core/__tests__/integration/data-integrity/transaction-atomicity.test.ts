/**
 * Transaction Atomicity Integration Test
 *
 * Tests that database operations are performed atomically:
 * - All related records are created together
 * - Database state remains consistent
 * - Concurrent transactions don't interfere
 * - Transaction boundaries are respected
 *
 * Note: Without database mocking, we verify correct atomic behavior
 * rather than injecting failures to test rollback mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";

describe("Integration: Transaction Atomicity", () => {
  let core: Core;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const context = await createIntegrationTestCore();
    core = context.core;
    cleanup = context.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should create all records atomically when sending first message", async () => {
    // Setup: Create provider
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Atomic Creation Test" });

    // Verify chat doesn't exist yet (pending state)
    const chatBeforeSend = await core.chats.get(pendingChat.id);
    expect(chatBeforeSend).toBeNull();

    // Send first message - should atomically create chat, user message, and assistant message
    let streamUpdates = 0;
    for await (const update of pendingChat.send({
      content: "Test atomicity",
      model: "gpt-4",
      providerConnectionId: provider.id,
    })) {
      streamUpdates++;
      expect(update.chatId).toBe(pendingChat.id);
      expect(update.messageId).toBeDefined();
    }

    expect(streamUpdates).toBeGreaterThan(0);

    // Verify all records were created atomically
    const chatAfterSend = await core.chats.get(pendingChat.id);
    expect(chatAfterSend).toBeDefined();
    expect(chatAfterSend!.chat.id).toBe(pendingChat.id);
    expect(chatAfterSend!.chat.title).toBe("Atomic Creation Test");

    // Verify both messages were created (user + assistant)
    expect(chatAfterSend!.messages).toHaveLength(2);
    expect(chatAfterSend!.messages[0].role).toBe("user");
    expect(chatAfterSend!.messages[0].content).toBe("Test atomicity");
    expect(chatAfterSend!.messages[1].role).toBe("assistant");
    expect(chatAfterSend!.messages[1].status).toBe("complete");

    // Verify FTS index was created atomically
    const searchResults = await core.search.messagesInChat(pendingChat.id, "atomicity");
    expect(searchResults).toHaveLength(1);
  });

  it("should maintain database consistency across multiple operations", async () => {
    // Setup: Create multiple chats with messages
    const provider = await createTestProviderConfig(core);

    const chat1 = core.chats.create({ title: "Chat 1" });
    await consumeStreamLast(
      chat1.send({
        content: "Message in chat 1",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    const chat2 = core.chats.create({ title: "Chat 2" });
    await consumeStreamLast(
      chat2.send({
        content: "Message in chat 2",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    const chat3 = core.chats.create({ title: "Chat 3" });
    await consumeStreamLast(
      chat3.send({
        content: "Message in chat 3",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify all chats exist
    const allChats = await core.chats.list();
    expect(allChats).toHaveLength(3);

    // Verify each chat has exactly 2 messages
    for (const chatInfo of allChats) {
      const chatData = await core.chats.get(chatInfo.id);
      expect(chatData?.messages).toHaveLength(2);
    }

    // Verify FTS consistency - each message should be searchable
    const search1 = await core.search.messages("chat 1");
    const search2 = await core.search.messages("chat 2");
    const search3 = await core.search.messages("chat 3");

    expect(search1.length).toBeGreaterThan(0);
    expect(search2.length).toBeGreaterThan(0);
    expect(search3.length).toBeGreaterThan(0);

    // Verify referential integrity - all messages reference valid chats
    for (const chatInfo of allChats) {
      const chatData = await core.chats.get(chatInfo.id);
      for (const message of chatData!.messages) {
        expect(message.chatId).toBe(chatInfo.id);
      }
    }
  });

  it("should handle concurrent transactions without interference", async () => {
    // Setup: Create provider
    const provider = await createTestProviderConfig(core);

    // Create multiple pending chats
    const pendingChats = [
      core.chats.create({ title: "Concurrent 1" }),
      core.chats.create({ title: "Concurrent 2" }),
      core.chats.create({ title: "Concurrent 3" }),
      core.chats.create({ title: "Concurrent 4" }),
    ];

    // Send messages concurrently - each should complete atomically
    const operations = pendingChats.map(async (chat, index) => {
      return consumeStreamLast(
        chat.send({
          content: `Concurrent message ${index + 1}`,
          model: "gpt-4",
          providerConnectionId: provider.id,
        })
      );
    });

    // Wait for all concurrent operations
    await Promise.all(operations);

    // Verify all chats were created
    const allChats = await core.chats.list();
    expect(allChats).toHaveLength(4);

    // Verify each chat has correct data
    for (let i = 0; i < 4; i++) {
      const chatData = await core.chats.get(pendingChats[i].id);
      expect(chatData).toBeDefined();
      expect(chatData!.chat.title).toBe(`Concurrent ${i + 1}`);
      expect(chatData!.messages).toHaveLength(2);

      // Verify user message content
      const userMsg = chatData!.messages.find(m => m.role === "user");
      expect(userMsg?.content).toBe(`Concurrent message ${i + 1}`);

      // Verify assistant message exists
      const assistantMsg = chatData!.messages.find(m => m.role === "assistant");
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.status).toBe("complete");
    }

    // Verify no data corruption - all chat IDs should be unique
    const chatIds = allChats.map(c => c.id);
    const uniqueIds = new Set(chatIds);
    expect(uniqueIds.size).toBe(4);

    // Verify all messages have unique IDs
    const allMessages = allChats.flatMap(async (chatInfo) => {
      const chatData = await core.chats.get(chatInfo.id);
      return chatData!.messages;
    });

    const resolvedMessages = await Promise.all(allMessages);
    const flatMessages = resolvedMessages.flat();
    const messageIds = flatMessages.map(m => m.id);
    const uniqueMessageIds = new Set(messageIds);
    expect(uniqueMessageIds.size).toBe(flatMessages.length);
  });

  it("should maintain transaction boundaries across operations", async () => {
    // Setup: Create provider and chat
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Transaction Boundary Test" });

    // Send first message - creates chat and first 2 messages
    await consumeStreamLast(
      pendingChat.send({
        content: "First message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Get chat after first message
    const chatAfterFirst = await core.chats.get(pendingChat.id);
    expect(chatAfterFirst?.messages).toHaveLength(2);

    const firstUserMessageId = chatAfterFirst!.messages[0].id;
    const firstAssistantMessageId = chatAfterFirst!.messages[1].id;

    // Send second message - should add 2 more messages without affecting first
    await consumeStreamLast(
      core.chats.sendMessage(pendingChat.id, {
        content: "Second message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify transaction boundary - first messages unchanged
    const chatAfterSecond = await core.chats.get(pendingChat.id);
    expect(chatAfterSecond?.messages).toHaveLength(4);

    // First messages should have same IDs
    expect(chatAfterSecond!.messages[0].id).toBe(firstUserMessageId);
    expect(chatAfterSecond!.messages[0].content).toBe("First message");
    expect(chatAfterSecond!.messages[1].id).toBe(firstAssistantMessageId);

    // Second messages should be new
    expect(chatAfterSecond!.messages[2].content).toBe("Second message");
    expect(chatAfterSecond!.messages[2].id).not.toBe(firstUserMessageId);
    expect(chatAfterSecond!.messages[3].id).not.toBe(firstAssistantMessageId);

    // Edit first message - should only affect that message
    await core.messages.edit(firstUserMessageId, "Edited first message");

    const chatAfterEdit = await core.chats.get(pendingChat.id);
    expect(chatAfterEdit?.messages).toHaveLength(4);
    expect(chatAfterEdit!.messages[0].content).toBe("Edited first message");
    expect(chatAfterEdit!.messages[2].content).toBe("Second message"); // Unchanged

    // Delete third message (second user message)
    await core.messages.delete(chatAfterEdit!.messages[2].id);

    const chatAfterDelete = await core.chats.get(pendingChat.id);
    expect(chatAfterDelete!.messages.length).toBeLessThan(4);

    // First message should still exist
    const firstMsgAfterDelete = chatAfterDelete!.messages.find(m => m.id === firstUserMessageId);
    expect(firstMsgAfterDelete).toBeDefined();
    expect(firstMsgAfterDelete!.content).toBe("Edited first message");

    // Verify FTS index is consistent
    const searchEdited = await core.search.messagesInChat(pendingChat.id, "Edited");
    expect(searchEdited.length).toBeGreaterThan(0);

    const searchSecond = await core.search.messagesInChat(pendingChat.id, "Second");
    expect(searchSecond.length).toBe(0); // Deleted message shouldn't be searchable
  });
});
