import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { HTTPRequest, HTTPResponse } from "@arc/core/platform/IPlatformHTTP.js";

/**
 * Capacitor platform HTTP implementation
 *
 * TODO: Implement using either:
 * - Native fetch API (similar to FetchHTTP)
 * - @capacitor/http plugin for native networking
 *
 * Supports:
 * - Standard HTTP requests
 * - Server-Sent Events (SSE) streaming
 * - Request cancellation via AbortSignal
 */
export class CapacitorHTTP implements IPlatformHTTP {
  constructor() {
    // TODO: Initialize Capacitor HTTP plugin if needed
  }

  /**
   * Perform a standard HTTP request
   *
   * TODO: Implement HTTP request handling
   * - Use fetch API or @capacitor/http plugin
   * - Handle request/response conversion
   * - Implement retry logic with exponential backoff
   */
  async request(url: string, options: HTTPRequest): Promise<HTTPResponse> {
    throw new Error("CapacitorHTTP.request() not implemented yet");
  }

  /**
   * Stream data from Server-Sent Events (SSE) endpoint
   *
   * TODO: Implement SSE streaming
   * - Establish stream connection
   * - Parse SSE format (data: {...}\n\n)
   * - Handle stream cancellation
   * - Implement retry logic for initial connection
   */
  async *stream(
    url: string,
    options: HTTPRequest
  ): AsyncGenerator<string, void, undefined> {
    throw new Error("CapacitorHTTP.stream() not implemented yet");
  }
}
