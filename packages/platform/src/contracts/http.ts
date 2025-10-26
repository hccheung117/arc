/**
 * Platform-agnostic HTTP abstraction
 *
 * Each platform (web, electron, mobile) provides its own implementation
 * using the appropriate HTTP client (fetch, node-fetch, axios, etc.)
 */

/**
 * HTTP request options
 */
export interface HTTPRequest {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/**
 * HTTP response
 */
export interface HTTPResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Platform HTTP interface
 *
 * Implementations must handle:
 * - Standard HTTP requests with JSON bodies
 * - Server-Sent Events (SSE) streaming
 * - Request cancellation via AbortSignal
 * - Error handling and timeout
 */
export interface PlatformHTTP {
  /**
   * Perform a standard HTTP request
   *
   * @param url - Full URL to request
   * @param options - Request options (method, headers, body, signal)
   * @returns Response with status, headers, and body
   * @throws Error on network failure or timeout
   */
  request(url: string, options: HTTPRequest): Promise<HTTPResponse>;

  /**
   * Stream data from a Server-Sent Events (SSE) endpoint
   *
   * Parses SSE format: "data: {...}\n\n"
   * Yields each JSON line as a string
   *
   * @param url - Full URL to stream from
   * @param options - Request options (method, headers, body, signal)
   * @returns AsyncGenerator yielding each data line
   * @throws Error on network failure, parse error, or cancellation
   */
  stream(
    url: string,
    options: HTTPRequest
  ): AsyncGenerator<string, void, undefined>;
}
