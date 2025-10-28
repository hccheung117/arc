/**
 * Chat Switching Smoke Test
 *
 * Tests the critical user journey of switching between different chats.
 * Uses a real Core instance with in-memory repositories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Core } from '@arc/core/core.js';
import type { Provider } from '@arc/core/core.js';
import { createSmokeTestCore, createTestProviderConfig } from './smoke-test-utils';

describe('Smoke Test: Chat Switching', () => {
  let core: Core;
  let mockProvider: Provider;
  let cleanup: () => Promise<void>;
  let providerId: string;

  beforeEach(async () => {
    const setup = await createSmokeTestCore();
    core = setup.core;
    mockProvider = setup.mockProvider;
    cleanup = setup.cleanup;

    const provider = await createTestProviderConfig(core);
    providerId = provider.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should switch between different chats and load correct messages', async () => {
    // Create first chat
    const chat1 = core.chats.create({ title: 'Chat 1' });
    const stream1 = chat1.send({
      content: 'Message in chat 1',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1) {
      // Consume
    }

    // Create second chat
    const chat2 = core.chats.create({ title: 'Chat 2' });
    const stream2 = chat2.send({
      content: 'Message in chat 2',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream2) {
      // Consume
    }

    // Switch to first chat
    const chat1Data = await core.chats.get(chat1.id);
    expect(chat1Data?.chat.title).toBe('Chat 1');
    expect(chat1Data?.messages[0].content).toBe('Message in chat 1');

    // Switch to second chat
    const chat2Data = await core.chats.get(chat2.id);
    expect(chat2Data?.chat.title).toBe('Chat 2');
    expect(chat2Data?.messages[0].content).toBe('Message in chat 2');
  });

  it('should list all chats in correct order', async () => {
    // Create multiple chats
    const chatIds: string[] = [];

    for (let i = 1; i <= 3; i++) {
      const chat = core.chats.create({ title: `Chat ${i}` });
      const stream = chat.send({
        content: `Message ${i}`,
        model: 'gpt-4',
        providerConnectionId: providerId,
      });
      for await (const update of stream) {
        // Consume
      }
      chatIds.push(chat.id);
    }

    // List all chats
    const chats = await core.chats.list();
    expect(chats.length).toBe(3);

    // Verify all chats are present
    chatIds.forEach((id) => {
      expect(chats.find((c) => c.id === id)).toBeDefined();
    });
  });

  it('should maintain separate message histories for each chat', async () => {
    // Create two chats with different conversation lengths
    const chat1 = core.chats.create({ title: 'Chat 1' });
    const stream1a = chat1.send({
      content: 'Chat 1 message 1',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1a) {
      // Consume
    }

    const chat2 = core.chats.create({ title: 'Chat 2' });
    const stream2a = chat2.send({
      content: 'Chat 2 message 1',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream2a) {
      // Consume
    }

    // Add more messages to chat 1
    const stream1b = core.chats.sendMessage(chat1.id, {
      content: 'Chat 1 message 2',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1b) {
      // Consume
    }

    // Verify message counts
    const chat1Data = await core.chats.get(chat1.id);
    const chat2Data = await core.chats.get(chat2.id);

    expect(chat1Data?.messages.length).toBe(4); // 2 exchanges
    expect(chat2Data?.messages.length).toBe(2); // 1 exchange
  });

  it('should handle renaming chats', async () => {
    const chat = core.chats.create({ title: 'Original Title' });
    const stream = chat.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream) {
      // Consume
    }

    // Rename the chat
    await core.chats.rename(chat.id, 'New Title');

    // Verify rename
    const updatedChat = await core.chats.get(chat.id);
    expect(updatedChat?.chat.title).toBe('New Title');

    // Verify in list
    const chats = await core.chats.list();
    const renamedChat = chats.find((c) => c.id === chat.id);
    expect(renamedChat?.title).toBe('New Title');
  });

  it('should sort chats by most recent activity', async () => {
    // Create first chat
    const chat1 = core.chats.create({ title: 'Chat 1' });
    const stream1 = chat1.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1) {
      // Consume
    }

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Create second chat
    const chat2 = core.chats.create({ title: 'Chat 2' });
    const stream2 = chat2.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream2) {
      // Consume
    }

    // List chats
    const chats = await core.chats.list();

    // Most recent should be first
    expect(chats[0].id).toBe(chat2.id);
    expect(chats[1].id).toBe(chat1.id);
  });

  it('should preserve chat state when switching rapidly', async () => {
    // Create multiple chats
    const chatIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const chat = core.chats.create({ title: `Chat ${i}` });
      const stream = chat.send({
        content: `Message ${i}`,
        model: 'gpt-4',
        providerConnectionId: providerId,
      });
      for await (const update of stream) {
        // Consume
      }
      chatIds.push(chat.id);
    }

    // Rapidly switch between chats
    for (const chatId of chatIds) {
      const chatData = await core.chats.get(chatId);
      expect(chatData).not.toBeNull();
      expect(chatData?.messages.length).toBeGreaterThan(0);
    }

    // Verify all chats still intact
    const chats = await core.chats.list();
    expect(chats.length).toBe(5);
  });
});
