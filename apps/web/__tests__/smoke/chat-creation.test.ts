/**
 * Chat Creation Smoke Test
 *
 * Tests the critical user journey of creating a new chat and sending the first message.
 * Uses a real Core instance with in-memory repositories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Core } from '@arc/core/core.js';
import type { Provider } from '@arc/ai/provider.type.js';
import { createSmokeTestCore, createTestProviderConfig } from './smoke-test-utils';

describe('Smoke Test: Chat Creation', () => {
  let core: Core;
  let mockProvider: Provider;
  let cleanup: () => Promise<void>;
  let providerId: string;

  beforeEach(async () => {
    const setup = await createSmokeTestCore();
    core = setup.core;
    mockProvider = setup.mockProvider;
    cleanup = setup.cleanup;

    // Create a test provider
    const provider = await createTestProviderConfig(core);
    providerId = provider.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create a new chat and send first message', async () => {
    // Step 1: Create a new chat
    const pendingChat = core.chats.create({ title: 'My First Chat' });
    expect(pendingChat.id).toBeDefined();
    expect(pendingChat.title).toBe('My First Chat');

    // Step 2: Send the first message
    const stream = pendingChat.send({
      content: 'Hello, AI!',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });

    // Step 3: Consume the stream
    let finalUpdate: any;
    for await (const update of stream) {
      finalUpdate = update;
    }

    // Step 4: Verify the final update
    expect(finalUpdate).toBeDefined();
    expect(finalUpdate.status).toBe('complete');

    // Step 5: Verify chat is in the list
    const chats = await core.chats.list();
    expect(chats).toHaveLength(1);
    expect(chats[0].id).toBe(pendingChat.id);
    expect(chats[0].title).toBe('My First Chat');
  });

  it('should persist chat and messages in database', async () => {
    // Create chat and send message
    const pendingChat = core.chats.create({ title: 'Persistent Chat' });
    const stream = pendingChat.send({
      content: 'Test message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });

    for await (const update of stream) {
      // Consume stream
    }

    // Retrieve the chat
    const chatWithMessages = await core.chats.get(pendingChat.id);

    expect(chatWithMessages).not.toBeNull();
    expect(chatWithMessages?.chat.title).toBe('Persistent Chat');
    expect(chatWithMessages?.messages).toBeDefined();
    expect(chatWithMessages?.messages.length).toBeGreaterThanOrEqual(2); // user + assistant
  });

  it('should create both user and assistant messages', async () => {
    const pendingChat = core.chats.create({ title: 'Test Chat' });
    const stream = pendingChat.send({
      content: 'User message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });

    for await (const update of stream) {
      // Consume stream
    }

    const chat = await core.chats.get(pendingChat.id);
    const messages = chat?.messages || [];

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('User message');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].status).toBe('complete');
  });

  it('should handle image attachments in first message', async () => {
    const pendingChat = core.chats.create({ title: 'Chat with Images' });

    const imageAttachment = {
      id: 'img-1',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANS',
      mimeType: 'image/png',
      size: 1024,
      name: 'test.png',
    };

    const stream = pendingChat.send({
      content: 'Look at this image',
      model: 'gpt-4',
      providerConnectionId: providerId,
      images: [imageAttachment],
    });

    for await (const update of stream) {
      // Consume stream
    }

    const chat = await core.chats.get(pendingChat.id);
    const userMessage = chat?.messages[0];

    expect(userMessage?.attachments).toBeDefined();
    expect(userMessage?.attachments?.length).toBe(1);
    expect(userMessage?.attachments?.[0].mimeType).toBe('image/png');
  });

  it('should stream assistant response progressively', async () => {
    const pendingChat = core.chats.create({ title: 'Streaming Test' });
    const stream = pendingChat.send({
      content: 'Test streaming',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });

    const updates: any[] = [];
    for await (const update of stream) {
      updates.push(update);
    }

    // Should have received multiple streaming updates
    expect(updates.length).toBeGreaterThan(1);

    // First updates should be streaming
    expect(updates[0].status).toBe('streaming');

    // Last update should be complete
    expect(updates[updates.length - 1].status).toBe('complete');
  });

  it('should set chat createdAt and updatedAt timestamps', async () => {
    const pendingChat = core.chats.create({ title: 'Timestamp Test' });
    const beforeSend = Date.now();

    // Send message to persist the chat
    const stream = pendingChat.send({
      content: 'First message',
      model: 'gpt-4',
      providerConnectionId: providerId,
    });

    for await (const update of stream) {
      // Consume stream
    }

    const afterSend = Date.now();

    // Get the chat from the list
    const chats = await core.chats.list();
    const chat = chats.find((c) => c.id === pendingChat.id);

    // Verify timestamps are set and within reasonable range
    expect(chat).toBeDefined();
    expect(chat?.createdAt).toBeDefined();
    expect(chat?.updatedAt).toBeDefined();
    expect(chat?.createdAt).toBeGreaterThanOrEqual(beforeSend);
    expect(chat?.createdAt).toBeLessThanOrEqual(afterSend);
    expect(chat?.updatedAt).toBeGreaterThanOrEqual(chat!.createdAt);
  });

  it('should handle errors gracefully when provider is invalid', async () => {
    const pendingChat = core.chats.create({ title: 'Error Test' });

    // Try to send with invalid provider ID
    const stream = pendingChat.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: 'invalid-provider-id',
    });

    // Should throw an error
    await expect(async () => {
      for await (const update of stream) {
        // Consume stream
      }
    }).rejects.toThrow();
  });
});
