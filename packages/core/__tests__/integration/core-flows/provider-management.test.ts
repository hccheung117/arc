/**
 * Provider Management Integration Test
 *
 * Tests the complete lifecycle of AI provider connections including
 * creation, validation, model listing, updates, and deletion.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Core } from "../../../src/core.js";
import { createIntegrationTestCore } from "../fixtures/test-utils.js";

describe("Integration: Provider Management", () => {
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

  it("should create provider with various configurations", async () => {
    // Create OpenAI provider
    const openaiProvider = await core.providers.create({
      name: "OpenAI Test",
      type: "openai",
      apiKey: "test-key-openai",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4",
    });

    expect(openaiProvider.id).toBeDefined();
    expect(openaiProvider.name).toBe("OpenAI Test");
    expect(openaiProvider.type).toBe("openai");
    expect(openaiProvider.apiKey).toBe("test-key-openai");
    expect(openaiProvider.baseUrl).toBe("https://api.openai.com/v1");
    expect(openaiProvider.defaultModel).toBe("gpt-4");
    expect(openaiProvider.enabled).toBe(true);
    expect(openaiProvider.createdAt).toBeDefined();
    expect(openaiProvider.updatedAt).toBeDefined();

    // Create Anthropic provider with custom headers
    const anthropicProvider = await core.providers.create({
      name: "Anthropic Test",
      type: "anthropic",
      apiKey: "test-key-anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      customHeaders: {
        "X-Custom-Header": "test-value",
      },
    });

    expect(anthropicProvider.id).toBeDefined();
    expect(anthropicProvider.type).toBe("anthropic");
    expect(anthropicProvider.customHeaders).toEqual({
      "X-Custom-Header": "test-value",
    });

    // Create custom provider
    const customProvider = await core.providers.create({
      name: "Custom Test",
      type: "custom",
      apiKey: "test-key-custom",
      baseUrl: "https://custom.api.com/v1",
      enabled: false, // Create disabled
    });

    expect(customProvider.type).toBe("custom");
    expect(customProvider.enabled).toBe(false);

    // Verify all providers are listed
    const allProviders = await core.providers.list();
    expect(allProviders).toHaveLength(3);
  });

  it("should validate provider connection", async () => {
    const provider = await core.providers.create({
      name: "Connection Test",
      type: "openai",
      apiKey: "test-api-key",
      baseUrl: "https://api.test.com/v1",
    });

    // Check connection (should succeed with mock provider)
    const isConnected = await core.providers.checkConnection(provider.id);
    expect(isConnected).toBe(true);
  });

  it("should list available models from provider", async () => {
    const provider = await core.providers.create({
      name: "Models Test",
      type: "openai",
      apiKey: "test-api-key",
      baseUrl: "https://api.test.com/v1",
    });

    // Get models list
    const models = await core.providers.getModels(provider.id);

    expect(models).toBeDefined();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);

    // Verify model structure (ModelInfo)
    const firstModel = models[0];
    expect(firstModel).toHaveProperty("id");
    expect(firstModel).toHaveProperty("object");
  });

  it("should update provider settings", async () => {
    const provider = await core.providers.create({
      name: "Original Name",
      type: "openai",
      apiKey: "original-key",
      baseUrl: "https://api.original.com/v1",
      defaultModel: "gpt-3.5-turbo",
    });

    const originalUpdatedAt = provider.updatedAt;

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update multiple fields
    const updated = await core.providers.update(provider.id, {
      name: "Updated Name",
      apiKey: "updated-key",
      baseUrl: "https://api.updated.com/v1",
      defaultModel: "gpt-4",
    });

    expect(updated.id).toBe(provider.id);
    expect(updated.name).toBe("Updated Name");
    expect(updated.apiKey).toBe("updated-key");
    expect(updated.baseUrl).toBe("https://api.updated.com/v1");
    expect(updated.defaultModel).toBe("gpt-4");
    expect(updated.type).toBe("openai"); // Type shouldn't change
    expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);

    // Verify changes persisted
    const providers = await core.providers.list();
    const persistedProvider = providers.find(p => p.id === provider.id);
    expect(persistedProvider?.name).toBe("Updated Name");
  });

  it("should update partial provider settings", async () => {
    const provider = await core.providers.create({
      name: "Partial Update Test",
      type: "openai",
      apiKey: "original-key",
      baseUrl: "https://api.test.com/v1",
    });

    // Update only the API key
    const updated = await core.providers.update(provider.id, {
      apiKey: "new-api-key",
    });

    expect(updated.name).toBe("Partial Update Test"); // Should remain unchanged
    expect(updated.apiKey).toBe("new-api-key"); // Should be updated
    expect(updated.baseUrl).toBe("https://api.test.com/v1"); // Should remain unchanged
    expect(updated.type).toBe("openai"); // Should remain unchanged
  });

  it("should enable and disable providers", async () => {
    const provider = await core.providers.create({
      name: "Enable/Disable Test",
      type: "openai",
      apiKey: "test-key",
      baseUrl: "https://api.test.com/v1",
      enabled: true,
    });

    expect(provider.enabled).toBe(true);

    // Disable provider
    const disabled = await core.providers.update(provider.id, {
      enabled: false,
    });

    expect(disabled.enabled).toBe(false);

    // Re-enable provider
    const enabled = await core.providers.update(provider.id, {
      enabled: true,
    });

    expect(enabled.enabled).toBe(true);
  });

  it("should delete provider and verify removal", async () => {
    const provider1 = await core.providers.create({
      name: "Provider 1",
      type: "openai",
      apiKey: "test-key-1",
      baseUrl: "https://api.test1.com/v1",
    });

    const provider2 = await core.providers.create({
      name: "Provider 2",
      type: "anthropic",
      apiKey: "test-key-2",
      baseUrl: "https://api.test2.com/v1",
    });

    // Verify both exist
    let allProviders = await core.providers.list();
    expect(allProviders).toHaveLength(2);

    // Delete provider1
    await core.providers.delete(provider1.id);

    // Verify only provider2 remains
    allProviders = await core.providers.list();
    expect(allProviders).toHaveLength(1);
    expect(allProviders[0].id).toBe(provider2.id);
  });

  it("should handle provider lifecycle atomically", async () => {
    // Create provider
    const created = await core.providers.create({
      name: "Lifecycle Test",
      type: "openai",
      apiKey: "test-key",
      baseUrl: "https://api.test.com/v1",
    });

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update it
    const updated = await core.providers.update(created.id, {
      name: "Updated Lifecycle Test",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);

    // Delete it
    await core.providers.delete(created.id);

    // Verify it's gone
    const allProviders = await core.providers.list();
    expect(allProviders.find(p => p.id === created.id)).toBeUndefined();
  });
});
