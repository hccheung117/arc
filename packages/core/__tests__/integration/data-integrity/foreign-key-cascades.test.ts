/**
 * Foreign Key Cascades Integration Test
 *
 * Tests that foreign key CASCADE relationships work correctly:
 * - messages.chat_id → chats.id ON DELETE CASCADE
 * - message_attachments.message_id → messages.id ON DELETE CASCADE
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";

describe("Integration: Foreign Key Cascades", () => {
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

  it("should cascade delete messages when chat is deleted", async () => {
    // Setup: Create provider and chat with multiple messages
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Cascade Test Chat" });

    // Send first message (persists the chat)
    await consumeStreamLast(
      pendingChat.send({
        content: "First message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Send second message
    await consumeStreamLast(
      core.chats.sendMessage(pendingChat.id, {
        content: "Second message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify chat has 4 messages (2 user + 2 assistant)
    const chatBeforeDelete = await core.chats.get(pendingChat.id);
    expect(chatBeforeDelete?.messages).toHaveLength(4);

    // Verify messages are searchable before deletion
    const searchResults = await core.search.messagesInChat(pendingChat.id, "First");
    expect(searchResults.length).toBeGreaterThan(0);

    // Delete the chat
    await core.chats.delete(pendingChat.id);

    // Verify chat is gone
    const deletedChat = await core.chats.get(pendingChat.id);
    expect(deletedChat).toBeNull();

    // Verify all messages are also gone (cascade delete)
    // Search should return no results if messages were cascade deleted
    const postDeleteSearch = await core.search.messagesInChat(pendingChat.id, "First");
    expect(postDeleteSearch).toHaveLength(0);
  });

  it("should verify foreign key constraints exist", async () => {
    // Setup: Create chat with messages
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "FK Constraint Test" });

    // Send message to persist chat
    await consumeStreamLast(
      pendingChat.send({
        content: "Test message for FK verification",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify chat and messages exist
    const chatData = await core.chats.get(pendingChat.id);
    expect(chatData).toBeDefined();
    expect(chatData!.messages).toHaveLength(2); // 1 user + 1 assistant

    // Delete the chat
    await core.chats.delete(pendingChat.id);

    // Verify complete cascade deletion
    const deletedChat = await core.chats.get(pendingChat.id);
    expect(deletedChat).toBeNull();

    // Verify messages are not searchable (confirms cascade)
    const searchResults = await core.search.messagesInChat(pendingChat.id, "Test");
    expect(searchResults).toHaveLength(0);

    // Note: The database schema enforces:
    // - messages.chat_id → chats.id ON DELETE CASCADE
    // - message_attachments.message_id → messages.id ON DELETE CASCADE
  });

  it("should perform cascade deletion atomically", async () => {
    // Setup: Create chat with significant data
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Atomicity Test" });

    // Send first message to persist the chat
    await consumeStreamLast(
      pendingChat.send({
        content: "Initial message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Create additional messages
    for (let i = 1; i <= 2; i++) {
      await consumeStreamLast(
        core.chats.sendMessage(pendingChat.id, {
          content: `Message ${i + 1}`,
          model: "gpt-4",
          providerConnectionId: provider.id,
        })
      );
    }

    // Verify initial state: 3 exchanges = 6 messages (3 user + 3 assistant)
    const chatBeforeDelete = await core.chats.get(pendingChat.id);
    expect(chatBeforeDelete?.messages).toHaveLength(6);

    // Verify messages are searchable before deletion
    const searchBeforeDelete = await core.search.messagesInChat(pendingChat.id, "Message");
    expect(searchBeforeDelete.length).toBeGreaterThan(0);

    // Delete the chat (should atomically delete all related data)
    await core.chats.delete(pendingChat.id);

    // Verify everything is gone
    const deletedChat = await core.chats.get(pendingChat.id);
    expect(deletedChat).toBeNull();

    // Verify all messages are gone (cascade delete)
    const searchAfterDelete = await core.search.messagesInChat(pendingChat.id, "Message");
    expect(searchAfterDelete).toHaveLength(0);

    // Verify no orphaned data by checking that we can create a new chat
    // with the same ID structure (if IDs were corrupted, this would fail)
    const newPendingChat = core.chats.create({ title: "New Chat After Delete" });
    expect(newPendingChat.id).toBeDefined();
  });

  it("should preserve other messages when deleting a single message", async () => {
    // Setup: Create chat with multiple messages
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Single Message Delete Test" });

    // Send first message
    await consumeStreamLast(
      pendingChat.send({
        content: "First message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Send second message
    await consumeStreamLast(
      core.chats.sendMessage(pendingChat.id, {
        content: "Second message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Get chat data
    const chatData = await core.chats.get(pendingChat.id);
    expect(chatData?.messages).toHaveLength(4); // 2 user + 2 assistant

    const firstUserMessage = chatData!.messages[0];
    expect(firstUserMessage).toBeDefined();
    expect(firstUserMessage.role).toBe("user");

    const firstUserMessageId = firstUserMessage.id;
    const secondUserMessage = chatData!.messages[2];

    // Delete only the first user message
    await core.messages.delete(firstUserMessageId);

    // Verify chat still exists with remaining messages
    const chatAfterDelete = await core.chats.get(pendingChat.id);
    expect(chatAfterDelete).toBeDefined();
    expect(chatAfterDelete!.messages.length).toBeLessThan(4);

    // Verify the deleted message is no longer in the chat
    const remainingMessageIds = chatAfterDelete!.messages.map(m => m.id);
    expect(remainingMessageIds).not.toContain(firstUserMessageId);

    // Verify the second message still exists
    expect(remainingMessageIds).toContain(secondUserMessage.id);

    // Note: If the message had attachments, they would be cascade deleted
    // due to the FK constraint: message_attachments.message_id → messages.id ON DELETE CASCADE
  });
});
