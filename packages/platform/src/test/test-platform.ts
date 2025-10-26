/**
 * Test Platform Implementation
 *
 * Provides a lightweight platform for smoke tests that uses sql.js directly
 * in-memory without IndexedDB persistence. Perfect for Node.js test environments.
 */

import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import type {
  Platform,
  PlatformDatabase,
  PlatformHTTP,
  PlatformFileSystem,
  DatabaseQueryResult,
  DatabaseExecResult,
  HTTPRequest,
  HTTPResponse,
} from '@arc/platform';

/**
 * In-memory test database using sql.js without IndexedDB
 */
class InMemoryTestDatabase implements PlatformDatabase {
  private sql: SqlJsStatic | null = null;
  private db: Database | null = null;
  private initialization: Promise<void> | null = null;
  private transactionDepth = 0;

  async init(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initialize();
    }
    return this.initialization;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.transactionDepth = 0;
    this.initialization = null;
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<DatabaseQueryResult<Row>> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    try {
      const statement = db.prepare(sql);
      try {
        if (params.length > 0) {
          statement.bind(params as SqlValue[]);
        }

        const rows: Row[] = [];
        while (statement.step()) {
          rows.push(statement.getAsObject() as Row);
        }

        return { rows };
      } finally {
        statement.free();
      }
    } catch (error) {
      throw new Error(
        `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async exec(sql: string, params: unknown[] = []): Promise<DatabaseExecResult> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    try {
      if (params.length > 0) {
        const statement = db.prepare(sql);
        try {
          statement.bind(params as SqlValue[]);
          statement.step();
          return { rowsAffected: db.getRowsModified() };
        } finally {
          statement.free();
        }
      } else {
        db.exec(sql);
        return { rowsAffected: db.getRowsModified() };
      }
    } catch (error) {
      throw new Error(
        `Exec failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async execScript(sql: string): Promise<void> {
    const script = sql.trim();
    if (!script) {
      return;
    }

    await this.transaction(async () => {
      const db = this.requireDatabase();
      try {
        db.exec(script);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Handle FTS5 not available in standard sql.js build
        if (errorMessage.includes('no such module: fts5')) {
          console.warn(
            '[TestPlatform] FTS5 extension not available in test environment. ' +
            'Skipping full-text search table creation. Search functionality will not be tested.'
          );

          // Remove FTS5-related SQL statements and retry
          const scriptWithoutFts5 = this.removeFts5Statements(script);
          try {
            db.exec(scriptWithoutFts5);
            return;
          } catch (retryError) {
            throw new Error(
              `Script execution failed after removing FTS5: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`
            );
          }
        }

        throw new Error(`Script execution failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Remove FTS5-related SQL statements from a script
   * This allows tests to run without FTS5 extension
   */
  private removeFts5Statements(sql: string): string {
    // Remove CREATE VIRTUAL TABLE ... USING fts5
    let cleaned = sql.replace(
      /CREATE\s+VIRTUAL\s+TABLE\s+IF\s+NOT\s+EXISTS\s+\w+\s+USING\s+fts5\s*\([^)]*\)\s*;/gi,
      ''
    );

    // Remove triggers that reference FTS tables (usually named *_fts_*)
    // Triggers end with END; so we need to match until END;
    cleaned = cleaned.replace(
      /CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+\w*fts\w*\s+[^;]+BEGIN[\s\S]*?END;/gi,
      ''
    );

    return cleaned;
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    this.transactionDepth++;
    const isOutermost = this.transactionDepth === 1;

    try {
      if (isOutermost) {
        db.exec('BEGIN TRANSACTION');
      }

      const result = await callback();

      if (isOutermost) {
        db.exec('COMMIT');
      }

      return result;
    } catch (error) {
      if (isOutermost) {
        try {
          db.exec('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors
        }
      }
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  private async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    if (!this.sql) {
      try {
        // Load sql.js - in Node.js, it will automatically find the WASM file
        // from its package directory. No locateFile override needed.
        this.sql = await initSqlJs();
      } catch (error) {
        throw new Error(
          `Failed to load sql.js: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    if (!this.sql) {
      throw new Error('SqlJsStatic failed to initialize');
    }

    // Create a new in-memory database (no IndexedDB)
    this.db = new this.sql.Database();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initialize();
    }
    await this.initialization;
  }

  private requireDatabase(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }
}

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
      yield* this.mockAIStream(url, options);
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
      url.includes('generativelanguage.googleapis.com')
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
 * Create a test platform for smoke tests
 *
 * This platform uses sql.js in-memory (no IndexedDB), native fetch for HTTP,
 * and a minimal filesystem stub. Perfect for Node.js test environments.
 */
export async function createTestPlatform(): Promise<Platform> {
  return {
    type: 'browser',
    database: new InMemoryTestDatabase(),
    http: new TestHTTP(),
    filesystem: new TestFileSystem(),
  };
}
