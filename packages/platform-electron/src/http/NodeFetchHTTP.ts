import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { HTTPRequest, HTTPResponse } from "@arc/core/platform/IPlatformHTTP.js";

/**
 * Retry configuration for network requests
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2,
};

/**
 * Node.js/Electron platform HTTP implementation using native fetch API
 *
 * Supports:
 * - Standard HTTP requests
 * - Server-Sent Events (SSE) streaming
 * - Request cancellation via AbortSignal
 * - Automatic retry with exponential backoff for network errors and 5xx responses
 */
export class NodeFetchHTTP implements IPlatformHTTP {
  private retryConfig: RetryConfig;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Helper to determine if an error/response should be retried
   */
  private shouldRetry(error: unknown, status?: number): boolean {
    // Don't retry 4xx client errors
    if (status && status >= 400 && status < 500) {
      return false;
    }

    // Retry 5xx server errors
    if (status && status >= 500) {
      return true;
    }

    // Retry network errors (but not abort errors)
    if (error instanceof Error) {
      return error.name !== "AbortError";
    }

    return true;
  }

  /**
   * Sleep for exponential backoff delay
   */
  private async sleep(retryCount: number): Promise<void> {
    const delay = Math.min(
      this.retryConfig.initialDelayMs *
        Math.pow(this.retryConfig.backoffMultiplier, retryCount),
      this.retryConfig.maxDelayMs
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Perform a standard HTTP request with retry logic
   */
  async request(url: string, options: HTTPRequest): Promise<HTTPResponse> {
    let lastError: Error | undefined;
    let lastStatus: number | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Build fetch options, only including defined properties
        const fetchOptions: RequestInit = {
          method: options.method,
        };

        if (options.headers !== undefined) {
          fetchOptions.headers = options.headers;
        }
        if (options.body !== undefined) {
          fetchOptions.body = options.body;
        }
        if (options.signal !== undefined) {
          fetchOptions.signal = options.signal;
        }

        const response = await fetch(url, fetchOptions);
        lastStatus = response.status;

        // Read response body as text
        const body = await response.text();

        // Convert Headers object to plain object
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const result: HTTPResponse = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
        };

        // If response is 5xx, treat it as retryable
        if (!response.ok && response.status >= 500) {
          lastError = new Error(
            `Server error: ${response.status} ${response.statusText}`
          );
          if (
            attempt < this.retryConfig.maxRetries &&
            this.shouldRetry(lastError, response.status)
          ) {
            console.warn(
              `Request failed with ${response.status}, retrying (${attempt + 1}/${this.retryConfig.maxRetries})...`
            );
            await this.sleep(attempt);
            continue;
          }
        }

        return result;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Unknown network error");

        // Don't retry abort errors
        if (lastError.name === "AbortError") {
          throw new Error("Request cancelled");
        }

        // Retry network errors
        if (
          attempt < this.retryConfig.maxRetries &&
          this.shouldRetry(error, lastStatus)
        ) {
          console.warn(
            `Network error, retrying (${attempt + 1}/${this.retryConfig.maxRetries}): ${lastError.message}`
          );
          await this.sleep(attempt);
          continue;
        }

        // Final attempt failed
        throw new Error(`Network error: ${lastError.message}`);
      }
    }

    // All retries exhausted
    throw lastError || new Error("Request failed after all retries");
  }

  /**
   * Stream data from Server-Sent Events (SSE) endpoint
   *
   * Parses SSE format and yields each data line
   * Retries initial connection, but not mid-stream failures
   */
  async *stream(
    url: string,
    options: HTTPRequest
  ): AsyncGenerator<string, void, undefined> {
    let response: Response | undefined;
    let lastError: Error | undefined;

    // Retry initial connection
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Build fetch options, only including defined properties
        const fetchOptions: RequestInit = {
          method: options.method,
          headers: {
            ...options.headers,
            Accept: "text/event-stream",
          },
        };

        if (options.body !== undefined) {
          fetchOptions.body = options.body;
        }
        if (options.signal !== undefined) {
          fetchOptions.signal = options.signal;
        }

        response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const errorBody = await response.text();
          lastError = new Error(
            `HTTP ${response.status}: ${response.statusText}\n${errorBody}`
          );

          // Retry 5xx errors
          if (
            response.status >= 500 &&
            attempt < this.retryConfig.maxRetries
          ) {
            console.warn(
              `Stream connection failed with ${response.status}, retrying (${attempt + 1}/${this.retryConfig.maxRetries})...`
            );
            await this.sleep(attempt);
            continue;
          }

          throw lastError;
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        // Connection successful, break retry loop
        break;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Unknown network error");

        if (lastError.name === "AbortError") {
          throw new Error("Request cancelled");
        }

        // Retry network errors
        if (
          attempt < this.retryConfig.maxRetries &&
          this.shouldRetry(error)
        ) {
          console.warn(
            `Stream connection error, retrying (${attempt + 1}/${this.retryConfig.maxRetries}): ${lastError.message}`
          );
          await this.sleep(attempt);
          continue;
        }

        throw lastError;
      }
    }

    // Ensure response was successfully obtained
    if (!response || !response.body) {
      throw lastError || new Error("Failed to establish stream connection");
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          // SSE format: "data: {...}"
          if (line.startsWith("data: ")) {
            const data = line.slice(6); // Remove "data: " prefix

            // OpenAI sends "[DONE]" to signal end of stream
            if (data === "[DONE]") {
              return;
            }

            yield data;
          }
          // Ignore empty lines and comments (lines starting with ":")
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Stream cancelled");
        }
        throw new Error(`Stream error: ${error.message}`);
      }
      throw new Error("Unknown stream error");
    } finally {
      reader.releaseLock();
    }
  }
}
