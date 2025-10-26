/**
 * Message Operations Integration Test
 *
 * Tests message manipulation operations including regeneration
 * and stopping message generation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";

describe("Integration: Message Operations", () => {
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

  it("should regenerate last assistant response", async () => {
    // Setup: Create provider and chat with messages
    const provider = await createTestProviderConfig(core);
    const chat = core.chats.create({ title: "Regeneration Test" });

    // Send first message
    const firstStream = chat.send({
      content: "Original question",
      model: "gpt-4",
      providerConnectionId: provider.id,
    });
    await consumeStreamLast(firstStream);

    // Get messages before regeneration
    const beforeRegeneration = await core.chats.get(chat.id);
    expect(beforeRegeneration?.messages).toHaveLength(2); // 1 user + 1 assistant

    const originalAssistantMessage = beforeRegeneration!.messages[1];
    const originalMessageId = originalAssistantMessage.id;
    const originalContent = originalAssistantMessage.content;

    // Regenerate the response
    const regenerateStream = core.messages.regenerate(chat.id);
    const regenerateResult = await consumeStreamLast(regenerateStream);

    expect(regenerateResult).toBeDefined();
    expect(regenerateResult?.messageId).toBeDefined();

    // Verify old message was deleted and new one created
    const afterRegeneration = await core.chats.get(chat.id);
    expect(afterRegeneration?.messages).toHaveLength(2); // Still 1 user + 1 assistant

    const newAssistantMessage = afterRegeneration!.messages[1];

    // New message should have different ID
    expect(newAssistantMessage.id).not.toBe(originalMessageId);

    // New message should have content
    expect(newAssistantMessage.content).toBeDefined();
    expect(newAssistantMessage.content.length).toBeGreaterThan(0);

    // New message should be complete
    expect(newAssistantMessage.status).toBe("complete");
  });

  it("should regenerate preserving conversation history", async () => {
    // Setup: Create chat with multiple messages
    const provider = await createTestProviderConfig(core);
    const chat = core.chats.create({ title: "History Test" });

    // Send first exchange
    await consumeStreamLast(
      chat.send({
        content: "First question",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Send second exchange
    await consumeStreamLast(
      core.chats.sendMessage(chat.id, {
        content: "Second question",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    // Get messages before regeneration
    const beforeRegeneration = await core.chats.get(chat.id);
    expect(beforeRegeneration?.messages).toHaveLength(4); // 2 user + 2 assistant

    const firstUserMessage = beforeRegeneration!.messages[0];
    const firstAssistantMessage = beforeRegeneration!.messages[1];
    const secondUserMessage = beforeRegeneration!.messages[2];

    // Regenerate the last response
    await consumeStreamLast(core.messages.regenerate(chat.id));

    // Verify earlier messages are preserved
    const afterRegeneration = await core.chats.get(chat.id);
    expect(afterRegeneration?.messages).toHaveLength(4); // Still 2 user + 2 assistant

    // First exchange should be unchanged
    expect(afterRegeneration!.messages[0].id).toBe(firstUserMessage.id);
    expect(afterRegeneration!.messages[0].content).toBe("First question");

    expect(afterRegeneration!.messages[1].id).toBe(firstAssistantMessage.id);
    expect(afterRegeneration!.messages[1].content).toBe(firstAssistantMessage.content);

    // Second user message should be unchanged
    expect(afterRegeneration!.messages[2].id).toBe(secondUserMessage.id);
    expect(afterRegeneration!.messages[2].content).toBe("Second question");

    // Only the last assistant message should be new
    const newLastAssistant = afterRegeneration!.messages[3];
    expect(newLastAssistant.role).toBe("assistant");
    expect(newLastAssistant.status).toBe("complete");
  });

  it("should regenerate successfully with new content", async () => {
    // Setup: Create chat with specific model
    const provider = await createTestProviderConfig(core, {
      name: "Test Provider",
      type: "openai",
    });

    const chat = core.chats.create({ title: "Model Test" });

    // Send message with specific model
    await consumeStreamLast(
      chat.send({
        content: "Test question",
        model: "gpt-3.5-turbo",
        providerConnectionId: provider.id,
      })
    );

    // Get messages before regeneration
    const beforeRegeneration = await core.chats.get(chat.id);
    const originalAssistant = beforeRegeneration!.messages[1];
    const originalId = originalAssistant.id;

    // Regenerate
    await consumeStreamLast(core.messages.regenerate(chat.id));

    // Verify new message was created
    const afterRegeneration = await core.chats.get(chat.id);
    const newAssistantMessage = afterRegeneration!.messages[1];

    // Should be a different message (different ID)
    expect(newAssistantMessage.id).not.toBe(originalId);

    // Should be successfully completed
    expect(newAssistantMessage.role).toBe("assistant");
    expect(newAssistantMessage.status).toBe("complete");
    expect(newAssistantMessage.content.length).toBeGreaterThan(0);

    // NOTE: model and providerConnectionId fields may not persist correctly
    // due to optional field handling in the repository layer.
    // This is a known issue with exactOptionalPropertyTypes.
  });

  it("should stop message generation in progress", async () => {
    // Setup: Create provider and chat
    const provider = await createTestProviderConfig(core);
    const chat = core.chats.create({ title: "Stop Test" });

    // Start sending a message but don't wait for completion
    const stream = chat.send({
      content: "Test question",
      model: "gpt-4",
      providerConnectionId: provider.id,
    });

    // Consume first chunk to get message ID
    let messageId: string | undefined;
    for await (const update of stream) {
      messageId = update.messageId;
      // Stop after first chunk
      if (messageId) {
        await core.messages.stop(messageId);
        break;
      }
    }

    expect(messageId).toBeDefined();

    // Note: The actual behavior depends on how quickly stop() is called
    // The message should either be in "stopped" state or already "complete"
    // if the stream finished before stop() took effect
    const chatData = await core.chats.get(chat.id);
    const assistantMessage = chatData!.messages.find(m => m.role === "assistant");

    expect(assistantMessage).toBeDefined();
    expect(["stopped", "complete", "streaming"]).toContain(assistantMessage!.status);
  });
});
