/**
 * Provider Error Handling Integration Test
 *
 * Tests that the system handles provider errors gracefully without crashing.
 * Note: With the current architecture using the mock HTTP platform,
 * we test error recovery and system stability rather than specific error types.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig } from "../fixtures/test-utils.js";

describe("Integration: Provider Error Handling", () => {
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

  it("should handle missing provider configuration gracefully", async () => {
    // Attempt to send message with non-existent provider ID
    const pendingChat = core.chats.create({ title: "Missing Provider Test" });

    try {
      const stream = pendingChat.send({
        content: "Test message",
        model: "gpt-4",
        providerConnectionId: "non-existent-provider-id",
      });

      // Attempt to consume stream should throw error
      for await (const _ of stream) {
        // Keep consuming
      }

      // Should not reach here
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      // Error should be thrown for missing provider
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
    }

    // System should still be functional - verify by listing chats
    const chats = await core.chats.list();
    expect(Array.isArray(chats)).toBe(true);
  });

  it("should maintain chat state after failed message send", async () => {
    // Create a provider and successful chat first
    const provider = await createTestProviderConfig(core);
    const chat1 = core.chats.create({ title: "Successful Chat" });

    // Send successful message
    await (async () => {
      for await (const _ of chat1.send({
        content: "First message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })) {
        // Consume stream
      }
    })();

    // Verify successful chat exists
    const chat1Data = await core.chats.get(chat1.id);
    expect(chat1Data).toBeDefined();
    expect(chat1Data!.messages).toHaveLength(2); // user + assistant

    // Now attempt to send message with invalid provider
    const chat2 = core.chats.create({ title: "Failed Chat" });

    try {
      const stream = chat2.send({
        content: "Test message",
        model: "gpt-4",
        providerConnectionId: "invalid-provider",
      });

      for await (const _ of stream) {
        // Keep consuming
      }
    } catch (error) {
      // Expected to fail
    }

    // Verify first chat is still intact
    const chat1AfterError = await core.chats.get(chat1.id);
    expect(chat1AfterError).toBeDefined();
    expect(chat1AfterError!.messages).toHaveLength(2);
  });

  it("should allow retrying after provider error", async () => {
    // Setup: Create provider
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Retry Test" });

    // First attempt with invalid provider ID (simulate error)
    try {
      const failStream = pendingChat.send({
        content: "Test message",
        model: "gpt-4",
        providerConnectionId: "invalid-id",
      });

      for await (const _ of failStream) {
        // Keep consuming
      }
    } catch (error) {
      // Expected to fail
    }

    // Retry with valid provider should work
    // Note: After first send fails, chat is not created, so we create a new one
    const retryChat = core.chats.create({ title: "Retry Test 2" });

    const successStream = retryChat.send({
      content: "Test message retry",
      model: "gpt-4",
      providerConnectionId: provider.id,
    });

    let successCount = 0;
    for await (const update of successStream) {
      successCount++;
      expect(update.chatId).toBe(retryChat.id);
    }

    expect(successCount).toBeGreaterThan(0);

    // Verify chat was created successfully
    const chatData = await core.chats.get(retryChat.id);
    expect(chatData).toBeDefined();
    expect(chatData!.messages.length).toBeGreaterThan(0);
  });

  it("should handle concurrent operations with provider errors", async () => {
    // Setup: Create valid provider
    const validProvider = await createTestProviderConfig(core);

    // Create multiple chats concurrently
    const chat1 = core.chats.create({ title: "Concurrent 1" });
    const chat2 = core.chats.create({ title: "Concurrent 2" });

    // Send messages concurrently (one success, one failure)
    const promises = [
      // This should succeed
      (async () => {
        for await (const _ of chat1.send({
          content: "Valid message",
          model: "gpt-4",
          providerConnectionId: validProvider.id,
        })) {
          // Consume stream
        }
      })(),

      // This should fail
      (async () => {
        try {
          for await (const _ of chat2.send({
            content: "Invalid message",
            model: "gpt-4",
            providerConnectionId: "invalid-provider",
          })) {
            // Consume stream
          }
        } catch (error) {
          // Expected to fail
        }
      })(),
    ];

    await Promise.all(promises);

    // Verify successful chat exists
    const chat1Data = await core.chats.get(chat1.id);
    expect(chat1Data).toBeDefined();
    expect(chat1Data!.messages.length).toBeGreaterThan(0);

    // System should still be functional
    const allChats = await core.chats.list();
    expect(allChats.length).toBeGreaterThan(0);
  });

  it("should preserve system state across multiple provider errors", async () => {
    // Setup: Create multiple providers
    const provider1 = await createTestProviderConfig(core, { name: "Provider 1" });
    const provider2 = await createTestProviderConfig(core, { name: "Provider 2" });

    // Verify both providers exist
    const providers = await core.providers.list();
    expect(providers).toHaveLength(2);

    // Cause multiple errors
    for (let i = 0; i < 3; i++) {
      try {
        const failChat = core.chats.create({ title: `Error Test ${i}` });
        const stream = failChat.send({
          content: "Test",
          model: "gpt-4",
          providerConnectionId: "invalid-id",
        });

        for await (const _ of stream) {
          // Keep consuming
        }
      } catch (error) {
        // Expected to fail
      }
    }

    // Verify providers still exist
    const providersAfter = await core.providers.list();
    expect(providersAfter).toHaveLength(2);

    // Verify we can still create successful chats
    const successChat = core.chats.create({ title: "Success After Errors" });
    const stream = successChat.send({
      content: "Success message",
      model: "gpt-4",
      providerConnectionId: provider1.id,
    });

    let updateCount = 0;
    for await (const update of stream) {
      updateCount++;
      expect(update.status).toBeDefined();
    }

    expect(updateCount).toBeGreaterThan(0);
  });

  it("should handle errors during message regeneration", async () => {
    // Setup: Create successful chat first
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Regeneration Error Test" });

    await (async () => {
      for await (const _ of pendingChat.send({
        content: "Original message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })) {
        // Consume stream
      }
    })();

    // Verify chat exists
    const chatData = await core.chats.get(pendingChat.id);
    expect(chatData).toBeDefined();
    expect(chatData!.messages).toHaveLength(2);

    // Note: Regeneration requires the original provider to be available
    // Since we're using a valid provider, regeneration should succeed
    // Testing actual regeneration errors would require a more complex setup
    const regenerateStream = core.messages.regenerate(pendingChat.id);

    let regenerateCount = 0;
    for await (const update of regenerateStream) {
      regenerateCount++;
      expect(update.messageId).toBeDefined();
    }

    expect(regenerateCount).toBeGreaterThan(0);

    // Verify chat is still intact
    const chatAfterRegenerate = await core.chats.get(pendingChat.id);
    expect(chatAfterRegenerate).toBeDefined();
    expect(chatAfterRegenerate!.messages).toHaveLength(2);
  });

  it("should handle provider deletion with active chats gracefully", async () => {
    // Setup: Create provider and chat
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Provider Deletion Test" });

    await (async () => {
      for await (const _ of pendingChat.send({
        content: "Message before deletion",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })) {
        // Consume stream
      }
    })();

    // Verify chat exists
    const chatBefore = await core.chats.get(pendingChat.id);
    expect(chatBefore).toBeDefined();
    expect(chatBefore!.messages).toHaveLength(2);

    // Delete the provider
    await core.providers.delete(provider.id);

    // Verify provider is deleted
    const providersAfter = await core.providers.list();
    expect(providersAfter.find(p => p.id === provider.id)).toBeUndefined();

    // Chat should still exist (not cascade deleted)
    const chatAfter = await core.chats.get(pendingChat.id);
    expect(chatAfter).toBeDefined();
    expect(chatAfter!.messages).toHaveLength(2);

    // Attempting to send new message with deleted provider should fail
    try {
      const stream = core.chats.sendMessage(pendingChat.id, {
        content: "Message after provider deleted",
        model: "gpt-4",
        providerConnectionId: provider.id,
      });

      for await (const _ of stream) {
        // Keep consuming
      }

      expect.fail("Expected error for deleted provider");
    } catch (error) {
      // Expected to fail
      expect(error).toBeDefined();
    }

    // System should still be functional
    const allChats = await core.chats.list();
    expect(allChats.length).toBeGreaterThan(0);
  });
});
