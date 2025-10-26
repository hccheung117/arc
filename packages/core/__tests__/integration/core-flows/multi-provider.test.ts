/**
 * Multi-Provider Integration Test
 *
 * Verifies that a single chat can switch between different providers/models
 * for different messages.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore, createTestProviderConfig, consumeStreamLast } from "../fixtures/test-utils.js";
import { createMockProvider } from "../fixtures/mock-provider.js";

describe("Integration: Multi-Provider Conversations", () => {
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

  it("should allow switching providers within a single chat", async () => {
    // Create two different providers
    const provider1 = await createTestProviderConfig(core, {
      name: "OpenAI Test",
      type: "openai",
    });

    const provider2 = await createTestProviderConfig(core, {
      name: "Anthropic Test",
      type: "anthropic",
    });

    // Start a chat
    const chat = core.chats.create({ title: "Multi-Provider Chat" });

    // Send first message with provider1
    const stream1 = chat.send({
      content: "First message",
      model: "gpt-4",
      providerConnectionId: provider1.id,
    });

    await consumeStreamLast(stream1);

    // Send second message with provider2
    const stream2 = core.chats.sendMessage(chat.id, {
      content: "Second message",
      model: "claude-3",
      providerConnectionId: provider2.id,
    });

    await consumeStreamLast(stream2);

    // Verify messages have different providers
    const chatData = await core.chats.get(chat.id);
    const messages = chatData!.messages;

    expect(messages).toHaveLength(4); // 2 user + 2 assistant

    // First assistant message (index 1) should use provider1
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].providerConnectionId).toBe(provider1.id);
    expect(messages[1].model).toBe("gpt-4");

    // Second assistant message (index 3) should use provider2
    expect(messages[3].role).toBe("assistant");
    expect(messages[3].providerConnectionId).toBe(provider2.id);
    expect(messages[3].model).toBe("claude-3");
  });

  it("should handle provider switching with different models", async () => {
    const provider = await createTestProviderConfig(core);

    const chat = core.chats.create({ title: "Model Switching Chat" });

    // Send messages with different models from same provider
    await consumeStreamLast(
      chat.send({
        content: "Message 1",
        model: "gpt-4",
        providerConnectionId: provider.id,
      })
    );

    await consumeStreamLast(
      core.chats.sendMessage(chat.id, {
        content: "Message 2",
        model: "gpt-3.5-turbo",
        providerConnectionId: provider.id,
      })
    );

    const chatData = await core.chats.get(chat.id);
    const messages = chatData!.messages;

    // Verify different models are tracked (check assistant messages at index 1 and 3)
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].model).toBe("gpt-4");

    expect(messages[3].role).toBe("assistant");
    expect(messages[3].model).toBe("gpt-3.5-turbo");
  });
});
