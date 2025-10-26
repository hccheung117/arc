/**
 * Test Platform Implementation
 *
 * Provides a lightweight platform for integration tests that uses better-sqlite3
 * in-memory database. Perfect for Node.js test environments.
 */

import { BetterSqlite3Database } from '../electron/electron-database.js';
import type {
  Platform,
  PlatformHTTP,
  PlatformFileSystem,
  HTTPRequest,
  HTTPResponse,
} from '@arc/platform';

/**
 * Test HTTP implementation that mocks AI provider responses
 */
class TestHTTP implements PlatformHTTP {
  async request(
    url: string,
    options: HTTPRequest
  ): Promise<HTTPResponse> {
    // Mock AI provider responses for testing
    if (this.isAIProviderRequest(url)) {
      return this.mockAIRequest(url, options);
    }

    // For non-AI requests, use real fetch
    const fetchOptions: RequestInit = {
      method: options.method,
    };
    if (options.headers) {
      fetchOptions.headers = options.headers;
    }
    if (options.body) {
      fetchOptions.body = options.body;
    }
    if (options.signal) {
      fetchOptions.signal = options.signal;
    }
    const response = await fetch(url, fetchOptions);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
    };
  }

  async *stream(
    url: string,
    options: HTTPRequest
  ): AsyncGenerator<string, void, undefined> {
    // Mock AI provider streaming responses for testing
    if (this.isAIProviderRequest(url)) {
      // Get raw SSE stream and parse it like BrowserFetch does
      let buffer = '';

      for await (const chunk of this.mockAIStream(url, options)) {
        // Add chunk to buffer
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          // SSE format: "data: {...}"
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove "data: " prefix

            // OpenAI sends "[DONE]" to signal end of stream
            if (data === '[DONE]') {
              return;
            }

            yield data;
          }
        }
      }
      return;
    }

    // For non-AI requests, use real fetch
    const fetchOptions: RequestInit = {
      method: options.method,
    };
    if (options.headers) {
      fetchOptions.headers = options.headers;
    }
    if (options.body) {
      fetchOptions.body = options.body;
    }
    if (options.signal) {
      fetchOptions.signal = options.signal;
    }
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }

  private isAIProviderRequest(url: string): boolean {
    return (
      url.includes('api.openai.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('api.test.com') // Mock test URLs
    );
  }

  private mockAIRequest(url: string, options: HTTPRequest): HTTPResponse {
    // Mock /models endpoint for listing available models
    if (url.includes('/models')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          object: 'list',
          data: [
            {
              id: 'gpt-4',
              object: 'model',
              name: 'GPT-4',
              contextWindow: 8192,
              supportsVision: true,
              supportsStreaming: true,
            },
            {
              id: 'gpt-3.5-turbo',
              object: 'model',
              name: 'GPT-3.5 Turbo',
              contextWindow: 4096,
              supportsVision: false,
              supportsStreaming: true,
            },
          ],
        }),
      };
    }

    // Mock chat completion endpoint (non-streaming)
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'mock-completion',
        object: 'chat.completion',
        created: Date.now(),
        model: 'mock-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Mock AI response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    };
  }

  private async *mockAIStream(
    url: string,
    options: HTTPRequest
  ): AsyncGenerator<string, void, undefined> {
    // Simulate OpenAI/Anthropic SSE streaming format
    const chunks = ['Mock', ' AI', ' response', '!'];

    for (let i = 0; i < chunks.length; i++) {
      // Check if request was aborted
      if (options.signal?.aborted) {
        throw new Error('Request aborted');
      }

      const isLast = i === chunks.length - 1;
      const chunk = {
        id: `mock-chunk-${i}`,
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'mock-model',
        choices: [
          {
            index: 0,
            delta: {
              content: chunks[i],
            },
            finish_reason: isLast ? 'stop' : null,
          },
        ],
      };

      // OpenAI SSE format: "data: {...}\n\n"
      yield `data: ${JSON.stringify(chunk)}\n\n`;

      // Delay AFTER yielding to allow abort signal to propagate
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 50));
        // Check if aborted after delay
        console.log(`[HTTP Mock] After chunk ${i}, signal.aborted=${options.signal?.aborted}`);
        if (options.signal?.aborted) {
          console.log('[HTTP Mock] Throwing Request aborted');
          throw new Error('Request aborted');
        }
      }
    }

    // Send [DONE] marker
    yield 'data: [DONE]\n\n';
  }
}

/**
 * Minimal filesystem stub (not used in smoke tests)
 */
class TestFileSystem implements PlatformFileSystem {
  async pickImages(options?: { multiple?: boolean }): Promise<import('../contracts/filesystem.js').PickedFile[]> {
    throw new Error('FileSystem not implemented in test environment');
  }

  async saveAttachment(
    attachmentId: string,
    chatId: string,
    fileName: string,
    mimeType: string,
    data: string | Buffer
  ): Promise<string> {
    throw new Error('FileSystem not implemented in test environment');
  }

  async loadAttachment(storagePath: string): Promise<string> {
    throw new Error('FileSystem not implemented in test environment');
  }

  async deleteAttachment(storagePath: string): Promise<void> {
    throw new Error('FileSystem not implemented in test environment');
  }

  async deleteAttachmentsForChat(chatId: string): Promise<void> {
    throw new Error('FileSystem not implemented in test environment');
  }
}

/**
 * Create a test platform for integration tests
 *
 * This platform uses better-sqlite3 in-memory database, native fetch for HTTP,
 * and a minimal filesystem stub. Perfect for Node.js test environments.
 */
export async function createTestPlatform(): Promise<Platform> {
  return {
    type: 'test',
    database: new BetterSqlite3Database({ filePath: ':memory:' }),
    http: new TestHTTP(),
    filesystem: new TestFileSystem(),
  };
}
