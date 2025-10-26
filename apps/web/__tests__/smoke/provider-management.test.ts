/**
 * Provider Management Smoke Test
 *
 * Tests the critical user journey of managing AI provider configurations.
 * Uses a real Core instance with in-memory repositories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Core } from '@arc/core/core.js';
import type { Provider } from '@arc/ai/provider.type.js';
import { createSmokeTestCore } from './smoke-test-utils';

describe('Smoke Test: Provider Management', () => {
  let core: Core;
  let mockProvider: Provider;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const setup = await createSmokeTestCore();
    core = setup.core;
    mockProvider = setup.mockProvider;
    cleanup = setup.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create a new provider configuration', async () => {
    const provider = await core.providers.create({
      name: 'My OpenAI',
      type: 'openai',
      apiKey: 'sk-test123',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
    });

    expect(provider.id).toBeDefined();
    expect(provider.name).toBe('My OpenAI');
    expect(provider.type).toBe('openai');
    expect(provider.enabled).toBe(true);
  });

  it('should list all provider configurations', async () => {
    // Create multiple providers
    await core.providers.create({
      name: 'OpenAI',
      type: 'openai',
      apiKey: 'sk-openai',
      baseUrl: 'https://api.openai.com/v1',
    });

    await core.providers.create({
      name: 'Anthropic',
      type: 'anthropic',
      apiKey: 'sk-anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    });

    const providers = await core.providers.list();
    expect(providers.length).toBe(2);
    expect(providers.find((p) => p.type === 'openai')).toBeDefined();
    expect(providers.find((p) => p.type === 'anthropic')).toBeDefined();
  });

  it('should update provider configuration', async () => {
    const provider = await core.providers.create({
      name: 'Test Provider',
      type: 'openai',
      apiKey: 'sk-old',
      baseUrl: 'https://api.openai.com/v1',
    });

    // Update the provider
    await core.providers.update(provider.id, {
      name: 'Updated Provider',
      apiKey: 'sk-new',
    });

    // Verify update
    const providers = await core.providers.list();
    const updated = providers.find((p) => p.id === provider.id);

    expect(updated?.name).toBe('Updated Provider');
    expect(updated?.apiKey).toBe('sk-new');
  });

  it('should delete provider configuration', async () => {
    const provider = await core.providers.create({
      name: 'To Delete',
      type: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
    });

    // Verify it exists
    let providers = await core.providers.list();
    expect(providers.find((p) => p.id === provider.id)).toBeDefined();

    // Delete it
    await core.providers.delete(provider.id);

    // Verify it's gone
    providers = await core.providers.list();
    expect(providers.find((p) => p.id === provider.id)).toBeUndefined();
  });

  it('should test provider connection', async () => {
    const provider = await core.providers.create({
      name: 'Test Provider',
      type: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
    });

    // Mock provider should pass health check
    await expect(core.providers.checkConnection(provider.id)).resolves.not.toThrow();
  });

  it('should get available models from provider', async () => {
    const provider = await core.providers.create({
      name: 'Test Provider',
      type: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
    });

    const models = await core.providers.getModels(provider.id);
    expect(models).toBeDefined();
    expect(Array.isArray(models)).toBe(true);
  });

  it('should handle enable/disable provider', async () => {
    const provider = await core.providers.create({
      name: 'Test Provider',
      type: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
    });

    // Disable provider
    await core.providers.update(provider.id, { enabled: false });

    let providers = await core.providers.list();
    let updated = providers.find((p) => p.id === provider.id);
    expect(updated?.enabled).toBe(false);

    // Re-enable provider
    await core.providers.update(provider.id, { enabled: true });

    providers = await core.providers.list();
    updated = providers.find((p) => p.id === provider.id);
    expect(updated?.enabled).toBe(true);
  });

  it('should handle custom provider with custom base URL', async () => {
    const provider = await core.providers.create({
      name: 'Custom Provider',
      type: 'custom',
      apiKey: 'custom-key',
      baseUrl: 'https://custom.api.com/v1',
    });

    expect(provider.type).toBe('custom');
    expect(provider.baseUrl).toBe('https://custom.api.com/v1');
  });

  it('should handle provider with custom headers', async () => {
    const provider = await core.providers.create({
      name: 'Custom Headers Provider',
      type: 'custom',
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com',
      customHeaders: {
        'X-Custom-Header': 'custom-value',
      },
    });

    expect(provider.customHeaders).toBeDefined();
    expect(provider.customHeaders?.['X-Custom-Header']).toBe('custom-value');
  });

  it('should handle provider with default model', async () => {
    const provider = await core.providers.create({
      name: 'Provider with Default Model',
      type: 'openai',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4',
    });

    expect(provider.defaultModel).toBe('gpt-4');
  });

  it('should prevent using deleted provider', async () => {
    const provider = await core.providers.create({
      name: 'To Delete',
      type: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
    });

    // Create a chat and send message
    const chat = core.chats.create({ title: 'Test' });
    const stream1 = chat.send({
      content: 'Test',
      model: 'gpt-4',
      providerConnectionId: provider.id,
    });
    for await (const update of stream1) {
      // Consume
    }

    // Delete the provider
    await core.providers.delete(provider.id);

    // Try to use the deleted provider
    await expect(async () => {
      const stream2 = core.chats.sendMessage(chat.id, {
        content: 'Test 2',
        model: 'gpt-4',
        providerConnectionId: provider.id,
      });
      for await (const update of stream2) {
        // Consume
      }
    }).rejects.toThrow();
  });

  it('should handle multiple providers of same type', async () => {
    const provider1 = await core.providers.create({
      name: 'OpenAI US',
      type: 'openai',
      apiKey: 'sk-us',
      baseUrl: 'https://api.openai.com/v1',
    });

    const provider2 = await core.providers.create({
      name: 'OpenAI EU',
      type: 'openai',
      apiKey: 'sk-eu',
      baseUrl: 'https://api.openai.eu/v1',
    });

    const providers = await core.providers.list();
    const openaiProviders = providers.filter((p) => p.type === 'openai');

    expect(openaiProviders.length).toBe(2);
    expect(openaiProviders.find((p) => p.name === 'OpenAI US')).toBeDefined();
    expect(openaiProviders.find((p) => p.name === 'OpenAI EU')).toBeDefined();
  });
});
