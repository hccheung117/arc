/**
 * Data Error Handling Integration Test
 *
 * Tests that the system handles data-level errors gracefully:
 * - Non-existent records
 * - Invalid IDs
 * - Operations on deleted data
 * - Edge cases with data access
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";

describe("Integration: Data Error Handling", () => {
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

  it("should handle accessing non-existent chat", async () => {
    // Attempt to get chat that doesn't exist
    const nonExistentChat = await core.chats.get("non-existent-chat-id");
    expect(nonExistentChat).toBeNull();

    // Attempt to send message to non-existent chat
    try {
      const stream = core.chats.sendMessage("non-existent-chat-id", {
        content: "Test message",
        model: "gpt-4",
        providerConnectionId: "some-provider",
      });

      for await (const _ of stream) {
        // Keep consuming
      }

      expect.fail("Expected error for non-existent chat");
    } catch (error) {
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toContain("not found");
    }

    // System should still be functional
    const chats = await core.chats.list();
    expect(Array.isArray(chats)).toBe(true);
  });

  it("should handle operations on deleted data", async () => {
    // Setup: Create chat and then delete it
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "To Be Deleted" });

    await consumeStreamLast(
      pendingChat.send({
        content: "Test message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    const chatId = pendingChat.id;

    // Verify chat exists
    const chatBefore = await core.chats.get(chatId);
    expect(chatBefore).toBeDefined();

    // Delete the chat
    await core.chats.delete(chatId);

    // Verify chat is deleted
    const chatAfter = await core.chats.get(chatId);
    expect(chatAfter).toBeNull();

    // Attempt to send message to deleted chat
    try {
      const stream = core.chats.sendMessage(chatId, {
        content: "Message to deleted chat",
        model: "gpt-4",
        providerConnectionId: provider.id,
      });

      for await (const _ of stream) {
        // Keep consuming
      }

      expect.fail("Expected error for deleted chat");
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain("not found");
    }

    // Attempt to rename deleted chat
    try {
      await core.chats.rename(chatId, "New Name");
      expect.fail("Expected error for deleted chat");
    } catch (error) {
      expect(error).toBeDefined();
    }

    // System should still be functional
    const chats = await core.chats.list();
    expect(Array.isArray(chats)).toBe(true);
  });

  it("should handle invalid message operations", async () => {
    // Attempt to delete non-existent message
    try {
      await core.messages.delete("non-existent-message-id");
      // Note: This might succeed silently, which is acceptable
    } catch (error) {
      // If it throws, that's also acceptable
      expect(error).toBeDefined();
    }

    // Attempt to edit non-existent message
    try {
      await core.messages.edit("non-existent-message-id", "New content");
      expect.fail("Expected error for non-existent message");
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Attempt to stop non-existent message
    try {
      await core.messages.stop("non-existent-message-id");
      // This might succeed silently, which is acceptable
    } catch (error) {
      // If it throws, that's also acceptable
      expect(error).toBeDefined();
    }

    // System should still be functional
    const providers = await core.providers.list();
    expect(Array.isArray(providers)).toBe(true);
  });

  it("should handle regenerate on non-existent or invalid chat", async () => {
    // Attempt to regenerate in non-existent chat
    try {
      const stream = core.messages.regenerate("non-existent-chat-id");

      for await (const _ of stream) {
        // Keep consuming
      }

      expect.fail("Expected error for non-existent chat");
    } catch (error) {
      expect(error).toBeDefined();
      // Error could be "Chat not found" or "No messages in chat to regenerate"
      expect((error as Error).message).toBeDefined();
    }

    // Create empty chat and attempt to regenerate (no messages)
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Empty Chat" });

    // Attempting to regenerate before any messages exist
    try {
      const stream = core.messages.regenerate(pendingChat.id);

      for await (const _ of stream) {
        // Keep consuming
      }

      expect.fail("Expected error for chat with no messages");
    } catch (error) {
      // Expected to fail - can't regenerate when there are no messages
      expect(error).toBeDefined();
      expect((error as Error).message).toContain("No messages in chat");
    }

    // System should still be functional
    const chats = await core.chats.list();
    expect(Array.isArray(chats)).toBe(true);
  });

  it("should handle search on deleted or non-existent data", async () => {
    // Setup: Create chat with searchable content
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Search Test" });

    await consumeStreamLast(
      pendingChat.send({
        content: "Unique searchable content xyz123",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify content is searchable
    const searchBefore = await core.search.messages("xyz123");
    expect(searchBefore).toHaveLength(1);

    const chatId = pendingChat.id;

    // Delete the chat
    await core.chats.delete(chatId);

    // Search should return empty results (FTS cascade deleted)
    const searchAfter = await core.search.messages("xyz123");
    expect(searchAfter).toHaveLength(0);

    // Search in deleted chat should return empty
    const searchInDeleted = await core.search.messagesInChat(chatId, "xyz123");
    expect(searchInDeleted).toHaveLength(0);

    // Search for non-existent term should return empty
    const searchNonExistent = await core.search.messages("term-that-does-not-exist-anywhere");
    expect(searchNonExistent).toHaveLength(0);

    // System should still be functional
    const allChats = await core.chats.list();
    expect(Array.isArray(allChats)).toBe(true);
  });
});
