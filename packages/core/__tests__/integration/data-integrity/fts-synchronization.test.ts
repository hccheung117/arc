/**
 * FTS Synchronization Integration Test
 *
 * Tests that the Full-Text Search index stays synchronized with message operations:
 * - INSERT: messages_fts_insert trigger
 * - UPDATE: messages_fts_update trigger
 * - DELETE: messages_fts_delete trigger
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";

describe("Integration: FTS Synchronization", () => {
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

  it("should update FTS index when creating messages", async () => {
    // Setup: Create provider and chat
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "FTS Insert Test" });

    // Send a message with unique searchable content
    await consumeStreamLast(
      pendingChat.send({
        content: "The quick brown fox jumps over the lazy dog",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify message is immediately searchable (FTS insert trigger worked)
    const searchResults = await core.search.messagesInChat(pendingChat.id, "quick");
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].message.content).toContain("quick");

    // Search for another term in the same message
    const searchResults2 = await core.search.messagesInChat(pendingChat.id, "fox");
    expect(searchResults2).toHaveLength(1);
    expect(searchResults2[0].message.content).toContain("fox");

    // Search for non-existent term should return empty
    const searchResults3 = await core.search.messagesInChat(pendingChat.id, "elephant");
    expect(searchResults3).toHaveLength(0);
  });

  it("should update FTS index when editing messages", async () => {
    // Setup: Create chat with a message
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "FTS Update Test" });

    await consumeStreamLast(
      pendingChat.send({
        content: "Original message content",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify original content is searchable
    const searchBefore = await core.search.messagesInChat(pendingChat.id, "Original");
    expect(searchBefore).toHaveLength(1);

    // Get the user message ID
    const chatData = await core.chats.get(pendingChat.id);
    const userMessage = chatData!.messages.find(m => m.role === "user");
    expect(userMessage).toBeDefined();

    // Edit the message
    await core.messages.edit(userMessage!.id, "Updated message content");

    // Verify FTS index was updated (old content not searchable)
    const searchOld = await core.search.messagesInChat(pendingChat.id, "Original");
    expect(searchOld).toHaveLength(0);

    // Verify new content is searchable
    const searchNew = await core.search.messagesInChat(pendingChat.id, "Updated");
    expect(searchNew).toHaveLength(1);
    expect(searchNew[0].message.content).toBe("Updated message content");
  });

  it("should update FTS index when deleting messages", async () => {
    // Setup: Create chat with multiple messages
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "FTS Delete Test" });

    // Send first message
    await consumeStreamLast(
      pendingChat.send({
        content: "First unique message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Send second message
    await consumeStreamLast(
      core.chats.sendMessage(pendingChat.id, {
        content: "Second unique message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify both messages are searchable
    const searchFirst = await core.search.messagesInChat(pendingChat.id, "First");
    expect(searchFirst).toHaveLength(1);

    const searchSecond = await core.search.messagesInChat(pendingChat.id, "Second");
    expect(searchSecond).toHaveLength(1);

    // Get the first user message
    const chatData = await core.chats.get(pendingChat.id);
    const firstUserMessage = chatData!.messages[0];
    expect(firstUserMessage.role).toBe("user");

    // Delete the first message
    await core.messages.delete(firstUserMessage.id);

    // Verify first message is no longer searchable (FTS delete trigger worked)
    const searchAfterDelete = await core.search.messagesInChat(pendingChat.id, "First");
    expect(searchAfterDelete).toHaveLength(0);

    // Verify second message is still searchable
    const searchSecondAfter = await core.search.messagesInChat(pendingChat.id, "Second");
    expect(searchSecondAfter).toHaveLength(1);
  });

  it("should handle FTS synchronization across multiple operations", async () => {
    // Setup: Create multiple chats with different content
    const provider = await createTestProviderConfig(core);

    const chat1 = core.chats.create({ title: "Chat 1" });
    await consumeStreamLast(
      chat1.send({
        content: "Apple banana cherry",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    const chat2 = core.chats.create({ title: "Chat 2" });
    await consumeStreamLast(
      chat2.send({
        content: "Apple durian elderberry",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Search globally for "Apple" should find both
    const searchApple = await core.search.messages("Apple");
    expect(searchApple).toHaveLength(2);

    // Search for "banana" should find only chat1
    const searchBanana = await core.search.messages("banana");
    expect(searchBanana).toHaveLength(1);
    expect(searchBanana[0].chatId).toBe(chat1.id);

    // Search for "durian" should find only chat2
    const searchDurian = await core.search.messages("durian");
    expect(searchDurian).toHaveLength(1);
    expect(searchDurian[0].chatId).toBe(chat2.id);

    // Delete chat1 (cascade delete should trigger FTS delete)
    await core.chats.delete(chat1.id);

    // Search for "Apple" should now find only chat2
    const searchAppleAfterDelete = await core.search.messages("Apple");
    expect(searchAppleAfterDelete).toHaveLength(1);
    expect(searchAppleAfterDelete[0].chatId).toBe(chat2.id);

    // Search for "banana" should return empty
    const searchBananaAfterDelete = await core.search.messages("banana");
    expect(searchBananaAfterDelete).toHaveLength(0);
  });
});
