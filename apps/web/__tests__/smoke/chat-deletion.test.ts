/**
 * Chat Deletion Smoke Test
 *
 * Tests the critical user journey of deleting chats.
 * Uses a real Core instance with in-memory repositories.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Core } from '@arc/core/core.js';
import { createSmokeTestCore, createTestProviderConfig } from './smoke-test-utils';

describe('Smoke Test: Chat Deletion', () => {
  let core: Core;
  let cleanup: () => Promise<void>;
  let providerId: string;

  beforeEach(async () => {
    const setup = await createSmokeTestCore();
    core = setup.core;
    cleanup = setup.cleanup;

    const provider = await createTestProviderConfig(core);
    providerId = provider.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should delete a chat and remove it from the list', async () => {
    // Create a chat
    const chat = core.chats.create({ title: 'To Delete' });
    const stream = chat.send({
      content: 'Test message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream) {
      // Consume
    }

    // Verify it exists
    let chats = await core.chats.list();
    expect(chats.find((c) => c.id === chat.id)).toBeDefined();

    // Delete it
    await core.chats.delete(chat.id);

    // Verify it's gone from the list
    chats = await core.chats.list();
    expect(chats.find((c) => c.id === chat.id)).toBeUndefined();
  });

  it('should delete chat and all associated messages', async () => {
    const chat = core.chats.create({ title: 'To Delete' });

    // Create multiple messages
    const stream1 = chat.send({
      content: 'Message 1',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream1) {
      // Consume
    }

    const stream2 = core.chats.sendMessage(chat.id, {
      content: 'Message 2',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream2) {
      // Consume
    }

    // Verify messages exist
    const chatData = await core.chats.get(chat.id);
    expect(chatData?.messages.length).toBeGreaterThan(0);

    // Delete chat
    await core.chats.delete(chat.id);

    // Try to get the chat
    const deletedChat = await core.chats.get(chat.id);
    expect(deletedChat).toBeNull();
  });

  it('should not affect other chats when deleting one', async () => {
    // Create multiple chats
    const chat1 = core.chats.create({ title: 'Chat 1' });
    const stream1 = chat1.send({
      content: 'Message 1',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream1) {
      // Consume
    }

    const chat2 = core.chats.create({ title: 'Chat 2' });
    const stream2 = chat2.send({
      content: 'Message 2',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream2) {
      // Consume
    }

    const chat3 = core.chats.create({ title: 'Chat 3' });
    const stream3 = chat3.send({
      content: 'Message 3',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream3) {
      // Consume
    }

    // Delete chat 2
    await core.chats.delete(chat2.id);

    // Verify chat 1 and 3 still exist
    const chats = await core.chats.list();
    expect(chats.length).toBe(2);
    expect(chats.find((c) => c.id === chat1.id)).toBeDefined();
    expect(chats.find((c) => c.id === chat3.id)).toBeDefined();
    expect(chats.find((c) => c.id === chat2.id)).toBeUndefined();
  });

  it('should handle deleting non-existent chat gracefully', async () => {
    // Try to delete a chat that doesn't exist
    await expect(core.chats.delete('non-existent-id')).rejects.toThrow();
  });

  it('should remove chat from search results after deletion', async () => {
    const chat1 = core.chats.create({ title: 'Important Chat' });
    const stream1 = chat1.send({
      content: 'Important content',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream1) {
      // Consume
    }

    const chat2 = core.chats.create({ title: 'Other Chat' });
    const stream2 = chat2.send({
      content: 'Important content',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream2) {
      // Consume
    }

    // Search before deletion
    let results = await core.search.messages('important');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.chatId === chat1.id)).toBe(true);

    // Delete chat1
    await core.chats.delete(chat1.id);

    // Search after deletion
    results = await core.search.messages('important');
    expect(results.every((r) => r.chatId !== chat1.id)).toBe(true);
  });

  it('should delete chat with image attachments', async () => {
    const chat = core.chats.create({ title: 'Chat with Images' });

    const imageAttachment = {
      id: 'img-1',
      data: 'data:image/png;base64,abc123',
      mimeType: 'image/png',
      size: 1024,
      name: 'test.png',
    };

    const stream = chat.send({
      content: 'Message with image',
      model: 'gpt-4',
      providerConnectionId: providerId,
      images: [imageAttachment],
    });
    for await (const _update of stream) {
      // Consume
    }

    // Verify chat exists with attachment
    const chatData = await core.chats.get(chat.id);
    expect(chatData?.messages[0].attachments).toBeDefined();

    // Delete chat
    await core.chats.delete(chat.id);

    // Verify deletion
    const deletedChat = await core.chats.get(chat.id);
    expect(deletedChat).toBeNull();
  });

  it('should delete chat with many messages efficiently', async () => {
    const chat = core.chats.create({ title: 'Large Chat' });

    // Create many messages
    for (let i = 0; i < 10; i++) {
      const stream = i === 0
        ? chat.send({
            content: `Message ${i}`,
            model: 'gpt-4',
            providerConnectionId: providerId,
          })
        : core.chats.sendMessage(chat.id, {
            content: `Message ${i}`,
            model: 'gpt-4',
            providerConnectionId: providerId,
          });

      for await (const _update of stream) {
        // Consume
      }
    }

    // Verify chat has many messages
    const chatData = await core.chats.get(chat.id);
    expect(chatData?.messages.length).toBeGreaterThan(10);

    // Delete should complete quickly
    const startTime = Date.now();
    await core.chats.delete(chat.id);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000); // Should take less than 1 second

    // Verify deletion
    const deletedChat = await core.chats.get(chat.id);
    expect(deletedChat).toBeNull();
  });

  it('should handle rapid consecutive deletions', async () => {
    // Create multiple chats
    const chatIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const chat = core.chats.create({ title: `Chat ${i}` });
      const stream = chat.send({
        content: `Message ${i}`,
        model: 'gpt-4',
        providerConnectionId: providerId,
      });
      for await (const _update of stream) {
        // Consume
      }
      chatIds.push(chat.id);
    }

    // Delete all rapidly
    await Promise.all(chatIds.map((id) => core.chats.delete(id)));

    // Verify all deleted
    const chats = await core.chats.list();
    expect(chats.length).toBe(0);
  });

  it('should update chat list order after deletion', async () => {
    // Create chats
    const chat1 = core.chats.create({ title: 'Chat 1' });
    const stream1 = chat1.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream1) {
      // Consume
    }

    const chat2 = core.chats.create({ title: 'Chat 2' });
    const stream2 = chat2.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream2) {
      // Consume
    }

    const chat3 = core.chats.create({ title: 'Chat 3' });
    const stream3 = chat3.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const _update of stream3) {
      // Consume
    }

    // Delete middle chat
    await core.chats.delete(chat2.id);

    // Verify list order
    const chats = await core.chats.list();
    expect(chats.length).toBe(2);
    expect(chats[0].id).toBe(chat3.id); // Most recent
    expect(chats[1].id).toBe(chat1.id); // Oldest
  });
});
