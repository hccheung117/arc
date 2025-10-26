/**
 * Smoke Test Utilities
 *
 * Helper functions for smoke tests that use real Core instances
 * with in-memory SQLite database and mock AI providers.
 */

import { vi } from 'vitest';
import { createCore, type Core } from '@arc/core/core.js';
import type { Provider } from '@arc/ai/provider.js';

/**
 * Local definition of RequestCancelledError for test environment
 * Matches the error thrown by providers when requests are cancelled
 */
class RequestCancelledError extends Error {
  constructor(message: string = 'Request was cancelled') {
    super(message);
    this.name = 'RequestCancelledError';
  }
}

/**
 * Create a real Core instance for smoke testing
 * Uses real in-memory SQLite database and mock AI provider
 */
export async function createSmokeTestCore(): Promise<{
  core: Core;
  mockProvider: Provider;
  cleanup: () => Promise<void>;
}> {

  // Create mock AI provider
  const mockProvider: Provider = {
    generateChatCompletion: vi.fn().mockResolvedValue({
      content: 'Mock response',
      usage: { inputTokens: 10, outputTokens: 5 },
      finishReason: 'stop',
    }),
    streamChatCompletion: vi.fn(),
    listModels: vi.fn().mockResolvedValue([
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'claude-3', name: 'Claude 3' },
    ]),
    healthCheck: vi.fn().mockResolvedValue(true),
    getCapabilities: vi.fn().mockReturnValue({
      supportsStreaming: true,
      supportsVision: true,
      supportsFunctionCalling: true,
    }),
  };

  // Setup streaming mock - respects abort signal
  vi.mocked(mockProvider.streamChatCompletion).mockImplementation(
    async function* (_messages, _model, options) {
      const signal = options?.signal;

      if (signal?.aborted) {
        throw new RequestCancelledError('Request was cancelled');
      }
      yield { content: 'Hello', usage: null, finishReason: null };

      // Delay to allow abort signal to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (signal?.aborted) {
        throw new RequestCancelledError('Request was cancelled');
      }
      yield { content: ' ', usage: null, finishReason: null };

      await new Promise((resolve) => setTimeout(resolve, 50));
      if (signal?.aborted) {
        throw new RequestCancelledError('Request was cancelled');
      }
      yield { content: 'world', usage: null, finishReason: null };

      await new Promise((resolve) => setTimeout(resolve, 50));
      if (signal?.aborted) {
        throw new RequestCancelledError('Request was cancelled');
      }
      yield { content: '!', usage: { inputTokens: 5, outputTokens: 3 }, finishReason: 'stop' };
    }
  );

  // Create real Core instance with test platform (in-memory database)
  const core = await createCore({ platform: 'test' });

  // Cleanup function
  const cleanup = async () => {
    await core.close();
  };

  return { core, mockProvider, cleanup };
}

/**
 * Create a test provider configuration for smoke tests
 */
export async function createTestProviderConfig(core: Core) {
  const provider = await core.providers.create({
    name: 'Test Provider',
    type: 'openai',
    apiKey: 'test-api-key',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
  });

  return provider;
}

/**
 * Wait for all async operations to complete
 */
export async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
