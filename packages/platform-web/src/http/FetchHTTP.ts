import type {
  IPlatformHTTP,
  HTTPRequest,
  HTTPResponse,
} from "@arc/core";

/**
 * Web platform HTTP implementation using native fetch API
 *
 * Supports:
 * - Standard HTTP requests
 * - Server-Sent Events (SSE) streaming
 * - Request cancellation via AbortSignal
 */
export class FetchHTTP implements IPlatformHTTP {
  /**
   * Perform a standard HTTP request
   */
  async request(url: string, options: HTTPRequest): Promise<HTTPResponse> {
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

      // Read response body as text
      const body = await response.text();

      // Convert Headers object to plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request cancelled");
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw new Error("Unknown network error");
    }
  }

  /**
   * Stream data from Server-Sent Events (SSE) endpoint
   *
   * Parses SSE format and yields each data line
   */
  async *stream(
    url: string,
    options: HTTPRequest
  ): AsyncGenerator<string, void, undefined> {
    let response: Response;

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
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}\n${errorBody}`
        );
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request cancelled");
        }
        throw error;
      }
      throw new Error("Unknown network error");
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
