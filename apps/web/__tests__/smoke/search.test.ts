/**
 * Search Smoke Test
 *
 * Tests the critical user journey of searching for messages.
 * Uses a real Core instance with in-memory repositories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Core } from '@arc/core/core.js';
import type { Provider } from '@arc/core/core.js';
import { createSmokeTestCore, createTestProviderConfig } from './smoke-test-utils';

describe('Smoke Test: Search', () => {
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

  it('should search for messages across all chats', async () => {
    // Create chats with specific content
    const chat1 = core.chats.create({ title: 'Chat 1' });
    const stream1 = chat1.send({
      content: 'Hello world from chat 1',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1) {
      // Consume
    }

    const chat2 = core.chats.create({ title: 'Chat 2' });
    const stream2 = chat2.send({
      content: 'Hello world from chat 2',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream2) {
      // Consume
    }

    // Search for "hello"
    const results = await core.search.messages('hello');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.chatId === chat1.id)).toBe(true);
    expect(results.some((r) => r.chatId === chat2.id)).toBe(true);
  });

  it('should search within a specific chat', async () => {
    const chat1 = core.chats.create({ title: 'Chat 1' });
    const stream1 = chat1.send({
      content: 'Specific content in chat 1',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1) {
      // Consume
    }

    const chat2 = core.chats.create({ title: 'Chat 2' });
    const stream2 = chat2.send({
      content: 'Different content in chat 2',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream2) {
      // Consume
    }

    // Search for "specific" only in chat 1
    const results = await core.search.messagesInChat(chat1.id, 'specific');

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.chatId === chat1.id)).toBe(true);
  });

  it('should return empty results for non-matching query', async () => {
    const chat = core.chats.create({ title: 'Test' });
    const stream = chat.send({
      content: 'Some content',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream) {
      // Consume
    }

    const results = await core.search.messages('nonexistent query xyz123');
    expect(results).toEqual([]);
  });

  it('should handle case-insensitive search', async () => {
    const chat = core.chats.create({ title: 'Test' });
    const stream = chat.send({
      content: 'Hello World',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream) {
      // Consume
    }

    // Search with different case
    const results = await core.search.messages('hello world');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search in both user and assistant messages', async () => {
    const chat = core.chats.create({ title: 'Test' });
    const stream = chat.send({
      content: 'User query with searchterm',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream) {
      // Consume
    }

    const results = await core.search.messages('searchterm');

    // Should find both user message and potentially assistant message
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search chat titles', async () => {
    const chat1 = core.chats.create({ title: 'Important Project Discussion' });
    const stream1 = chat1.send({
      content: 'Some message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1) {
      // Consume
    }

    const chat2 = core.chats.create({ title: 'Random Chat' });
    const stream2 = chat2.send({
      content: 'Another message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream2) {
      // Consume
    }

    const results = await core.search.chats('important project');

    expect(results.length).toBeGreaterThan(0);
    expect(results.find((c) => c.id === chat1.id)).toBeDefined();
  });

  it('should return search results with context', async () => {
    const chat = core.chats.create({ title: 'Test' });
    const stream = chat.send({
      content: 'This is a test message with searchable content',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream) {
      // Consume
    }

    const results = await core.search.messagesInChat(chat.id, 'searchable');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].message).toBeDefined();
    expect(results[0].message.content).toContain('searchable');
    expect(results[0].chatId).toBe(chat.id);
  });

  it('should search in multi-turn conversations', async () => {
    const chat = core.chats.create({ title: 'Multi-turn' });

    // Multiple exchanges
    const stream1 = chat.send({
      content: 'First unique message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream1) {
      // Consume
    }

    const stream2 = core.chats.sendMessage(chat.id, {
      content: 'Second unique message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream2) {
      // Consume
    }

    const stream3 = core.chats.sendMessage(chat.id, {
      content: 'Third unique message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream3) {
      // Consume
    }

    // Search for content in different messages
    const results1 = await core.search.messagesInChat(chat.id, 'first');
    const results2 = await core.search.messagesInChat(chat.id, 'second');
    const results3 = await core.search.messagesInChat(chat.id, 'third');

    expect(results1.length).toBeGreaterThan(0);
    expect(results2.length).toBeGreaterThan(0);
    expect(results3.length).toBeGreaterThan(0);
  });

  it('should handle special characters in search query', async () => {
    const chat = core.chats.create({ title: 'Test' });
    const stream = chat.send({
      content: 'Message with special chars: @#$%',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });
    for await (const update of stream) {
      // Consume
    }

    const results = await core.search.messages('special chars');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search across many chats efficiently', async () => {
    // Create many chats
    for (let i = 0; i < 10; i++) {
      const chat = core.chats.create({ title: `Chat ${i}` });
      const stream = chat.send({
        content: `Message ${i} with common keyword`,
        model: 'gpt-4',
        providerConnectionId: providerId,
      });
      for await (const update of stream) {
        // Consume
      }
    }

    // Search across all
    const results = await core.search.messages('keyword');

    // Should find messages from multiple chats
    expect(results.length).toBeGreaterThan(5);
  });
});
