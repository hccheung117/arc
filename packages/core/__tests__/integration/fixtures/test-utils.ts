/**
 * Integration Test Utilities
 *
 * Helper functions for setting up and managing integration tests.
 */

import type { Core } from "../../../src/core.js";
import { createCore } from "../../../src/core.js";
import type { Provider } from "@arc/ai/provider.type.js";
import type { ProviderConfig } from "../../../src/providers/provider-config.js";
import { createMockProvider } from "./mock-provider.js";

export interface IntegrationTestContext {
  core: Core;
  mockProvider: Provider;
  cleanup: () => Promise<void>;
}

/**
 * Create a Core instance for integration testing with test platform
 */
export async function createIntegrationTestCore(
  mockProvider?: Provider
): Promise<IntegrationTestContext> {
  const provider = mockProvider ?? createMockProvider();

  // Create core with test platform (in-memory database)
  const core = await createCore({ platform: "test" });

  const cleanup = async () => {
    await core.close();
  };

  return {
    core,
    mockProvider: provider,
    cleanup,
  };
}

/**
 * Create a test provider configuration
 */
export async function createTestProviderConfig(
  core: Core,
  overrides?: Partial<ProviderConfig>
): Promise<ProviderConfig> {
  return await core.providers.create({
    name: "Test Provider",
    type: "openai",
    apiKey: "test-api-key",
    baseUrl: "https://api.test.com/v1",
    ...overrides,
  });
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (true) {
    if (await condition()) {
      return;
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Consume an async generator and return all values
 */
export async function consumeStream<T>(stream: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of stream) {
    results.push(item);
  }
  return results;
}

/**
 * Consume a stream and return only the last value
 */
export async function consumeStreamLast<T>(stream: AsyncGenerator<T>): Promise<T | undefined> {
  let last: T | undefined;
  for await (const item of stream) {
    last = item;
  }
  return last;
}

/**
 * Assert that an async function throws a specific error type
 *
 * @example
 * await expectError(
 *   () => core.providers.get("non-existent"),
 *   Error,
 *   "Provider non-existent not found"
 * );
 */
export async function expectError<E extends Error>(
  fn: () => Promise<unknown>,
  errorType: new (...args: unknown[]) => E,
  messageContains?: string
): Promise<E> {
  try {
    await fn();
    throw new Error(`Expected ${errorType.name} to be thrown, but no error was thrown`);
  } catch (error) {
    if (!(error instanceof errorType)) {
      throw new Error(
        `Expected ${errorType.name}, but got ${error instanceof Error ? error.constructor.name : typeof error}`
      );
    }

    if (messageContains && !error.message.includes(messageContains)) {
      throw new Error(
        `Expected error message to contain "${messageContains}", but got: "${error.message}"`
      );
    }

    return error;
  }
}

/**
 * Assert that an async generator throws a specific error type
 *
 * @example
 * await expectStreamError(
 *   chat.send({ content: "test", model: "gpt-4", providerConnectionId: badProviderId }),
 *   ProviderAuthError
 * );
 */
export async function expectStreamError<E extends Error>(
  stream: AsyncGenerator<unknown>,
  errorType: new (...args: unknown[]) => E,
  messageContains?: string
): Promise<E> {
  try {
    // Consume the stream
    for await (const _ of stream) {
      // Keep consuming
    }
    throw new Error(`Expected ${errorType.name} to be thrown, but stream completed successfully`);
  } catch (error) {
    if (!(error instanceof errorType)) {
      throw new Error(
        `Expected ${errorType.name}, but got ${error instanceof Error ? error.constructor.name : typeof error}`
      );
    }

    if (messageContains && !error.message.includes(messageContains)) {
      throw new Error(
        `Expected error message to contain "${messageContains}", but got: "${error.message}"`
      );
    }

    return error;
  }
}
