/**
 * Graceful Degradation Integration Test
 *
 * Tests that the system gracefully degrades when errors occur, ensuring:
 * - Failed operations don't corrupt existing state
 * - System remains functional after errors
 * - Successful operations complete despite concurrent failures
 * - State consistency is maintained across error scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";

describe("Integration: Graceful Degradation", () => {
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

  it("should not corrupt chat state when message send fails", async () => {
    // Setup: Create successful chat first
    const provider = await createTestProviderConfig(core);
    const successfulChat = core.chats.create({ title: "Successful Chat" });

    // Send first successful message
    await consumeStreamLast(
      successfulChat.send({
        content: "First successful message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Send second successful message
    await consumeStreamLast(
      core.chats.sendMessage(successfulChat.id, {
        content: "Second successful message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify successful chat has 4 messages (2 user + 2 assistant)
    const chatBeforeError = await core.chats.get(successfulChat.id);
    expect(chatBeforeError?.messages).toHaveLength(4);

    const originalMessages = chatBeforeError!.messages.map(m => ({
      id: m.id,
      content: m.content,
      role: m.role,
    }));

    // Attempt to send message with invalid provider (should fail)
    try {
      const failStream = core.chats.sendMessage(successfulChat.id, {
        content: "This should fail",
        model: "gpt-4",
        providerConnectionId: "non-existent-provider",
      });

      for await (const _ of failStream) {
        // Keep consuming
      }
    } catch (error) {
      // Expected to fail
    }

    // Verify original messages are intact
    // Note: Error may create additional messages (user message + error assistant message)
    const chatAfterError = await core.chats.get(successfulChat.id);
    expect(chatAfterError?.messages.length).toBeGreaterThanOrEqual(4);

    // Verify first 4 original messages are intact with exact same IDs and content
    const preservedMessages = chatAfterError!.messages.slice(0, 4);
    preservedMessages.forEach((msg, index) => {
      expect(msg.id).toBe(originalMessages[index].id);
      expect(msg.content).toBe(originalMessages[index].content);
      expect(msg.role).toBe(originalMessages[index].role);
    });

    // Key point: The original 4 messages are completely preserved
    // Any additional messages are from the failed operation

    // Verify chat is still searchable
    const searchResults = await core.search.messagesInChat(successfulChat.id, "First");
    expect(searchResults.length).toBeGreaterThan(0);

    // Verify we can still send successful messages
    const messageCountBeforeRecovery = chatAfterError!.messages.length;

    await consumeStreamLast(
      core.chats.sendMessage(successfulChat.id, {
        content: "Recovery message",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    const chatAfterRecovery = await core.chats.get(successfulChat.id);
    // Should have 2 more messages (user + assistant) after recovery
    expect(chatAfterRecovery?.messages.length).toBe(messageCountBeforeRecovery + 2);

    // Verify recovery message was successful
    const recoveryMsg = chatAfterRecovery!.messages.find(m => m.content === "Recovery message");
    expect(recoveryMsg).toBeDefined();
    expect(recoveryMsg!.role).toBe("user");
  });

  it("should preserve existing messages when regeneration fails", async () => {
    // Setup: Create chat with messages
    const provider = await createTestProviderConfig(core);
    const pendingChat = core.chats.create({ title: "Regeneration Test" });

    await consumeStreamLast(
      pendingChat.send({
        content: "Original message content",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Get messages before attempting regeneration
    const chatBefore = await core.chats.get(pendingChat.id);
    expect(chatBefore?.messages).toHaveLength(2);

    const originalUserMessage = chatBefore!.messages[0];
    const originalAssistantMessage = chatBefore!.messages[1];

    // Delete the provider to cause regeneration to fail
    await core.providers.delete(provider.id);

    // Attempt to regenerate (should fail due to missing provider)
    try {
      const regenerateStream = core.messages.regenerate(pendingChat.id);

      for await (const _ of regenerateStream) {
        // Keep consuming
      }
    } catch (error) {
      // Expected to fail
    }

    // Verify original messages are preserved
    const chatAfter = await core.chats.get(pendingChat.id);
    expect(chatAfter?.messages).toHaveLength(2);

    // User message should be unchanged
    expect(chatAfter!.messages[0].id).toBe(originalUserMessage.id);
    expect(chatAfter!.messages[0].content).toBe(originalUserMessage.content);

    // Assistant message might have been deleted and recreated (or preserved)
    // Either way, chat should still have exactly 2 messages
    expect(chatAfter!.messages[1].role).toBe("assistant");

    // Chat should still be accessible
    const chats = await core.chats.list();
    expect(chats.find(c => c.id === pendingChat.id)).toBeDefined();
  });

  it("should handle mixed success and failure in concurrent operations", async () => {
    // Setup: Create multiple providers
    const validProvider = await createTestProviderConfig(core, { name: "Valid Provider" });

    // Create multiple chats for concurrent operations
    const chats = [
      core.chats.create({ title: "Chat 1 - Will Succeed" }),
      core.chats.create({ title: "Chat 2 - Will Fail" }),
      core.chats.create({ title: "Chat 3 - Will Succeed" }),
      core.chats.create({ title: "Chat 4 - Will Fail" }),
    ];

    // Execute concurrent operations (some will succeed, some will fail)
    const operations = [
      // Success
      (async () => {
        await consumeStreamLast(
          chats[0].send({
            content: "Successful message 1",
            model: "gpt-4",
            providerConnectionId: validProvider.id,
          })
        );
      })(),

      // Failure
      (async () => {
        try {
          await consumeStreamLast(
            chats[1].send({
              content: "Failed message",
              model: "gpt-4",
              providerConnectionId: "invalid-provider",
            })
          );
        } catch (error) {
          // Expected to fail
        }
      })(),

      // Success
      (async () => {
        await consumeStreamLast(
          chats[2].send({
            content: "Successful message 2",
            model: "gpt-4",
            providerConnectionId: validProvider.id,
          })
        );
      })(),

      // Failure
      (async () => {
        try {
          await consumeStreamLast(
            chats[3].send({
              content: "Failed message 2",
              model: "gpt-4",
              providerConnectionId: "invalid-provider-2",
            })
          );
        } catch (error) {
          // Expected to fail
        }
      })(),
    ];

    // Wait for all operations to complete
    await Promise.all(operations);

    // Verify successful chats exist with correct message count
    const chat1Data = await core.chats.get(chats[0].id);
    expect(chat1Data).toBeDefined();
    expect(chat1Data!.messages).toHaveLength(2);
    expect(chat1Data!.messages[0].content).toBe("Successful message 1");

    const chat3Data = await core.chats.get(chats[2].id);
    expect(chat3Data).toBeDefined();
    expect(chat3Data!.messages).toHaveLength(2);
    expect(chat3Data!.messages[0].content).toBe("Successful message 2");

    // Failed chats should not be persisted (PendingChat doesn't persist on failure)
    // But the system should still be functional
    const allChats = await core.chats.list();
    expect(allChats.length).toBeGreaterThanOrEqual(2);

    // Verify provider still exists
    const providers = await core.providers.list();
    expect(providers.find(p => p.id === validProvider.id)).toBeDefined();

    // System should still accept new operations
    const recoveryChat = core.chats.create({ title: "Recovery Chat" });
    await consumeStreamLast(
      recoveryChat.send({
        content: "Recovery works",
        model: "gpt-4",
        providerConnectionId: validProvider.id,
      })
    );

    const recoveryData = await core.chats.get(recoveryChat.id);
    expect(recoveryData).toBeDefined();
  });

  it("should recover system functionality after multiple sequential failures", async () => {
    // Setup: Create provider
    const provider = await createTestProviderConfig(core);

    // Cause multiple failures in sequence
    const failureCount = 5;
    for (let i = 0; i < failureCount; i++) {
      try {
        const failChat = core.chats.create({ title: `Failure Test ${i}` });
        const stream = failChat.send({
          content: `Failure attempt ${i}`,
          model: "gpt-4",
          providerConnectionId: "non-existent-provider",
        });

        for await (const _ of stream) {
          // Keep consuming
        }
      } catch (error) {
        // Expected to fail
      }
    }

    // Verify system is still functional
    const providersAfterFailures = await core.providers.list();
    expect(providersAfterFailures).toHaveLength(1);
    expect(providersAfterFailures[0].id).toBe(provider.id);

    // Create successful chat
    const successChat = core.chats.create({ title: "Success After Failures" });
    await consumeStreamLast(
      successChat.send({
        content: "This should succeed",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Verify successful chat was created
    const successData = await core.chats.get(successChat.id);
    expect(successData).toBeDefined();
    expect(successData!.messages).toHaveLength(2);
    expect(successData!.messages[0].content).toBe("This should succeed");

    // Continue operations - send another message
    await consumeStreamLast(
      core.chats.sendMessage(successChat.id, {
        content: "Second message after recovery",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    const finalData = await core.chats.get(successChat.id);
    expect(finalData?.messages).toHaveLength(4);

    // Verify search still works
    const searchResults = await core.search.messages("succeed");
    expect(searchResults.length).toBeGreaterThan(0);

    // Verify provider operations still work
    const models = await core.providers.getModels(provider.id);
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });
});
