import { ProviderError, ProviderErrorCode } from "@arc/core/domain/ProviderError.js";
import type { GeminiErrorResponse } from "./types.js";

/**
 * Map HTTP status code to ProviderErrorCode
 */
function mapStatusToErrorCode(status: number): ProviderErrorCode {
  switch (status) {
    case 401:
      return ProviderErrorCode.INVALID_API_KEY;
    case 403:
      return ProviderErrorCode.INSUFFICIENT_QUOTA;
    case 429:
      return ProviderErrorCode.RATE_LIMIT_EXCEEDED;
    case 400:
      return ProviderErrorCode.INVALID_REQUEST;
    case 404:
      return ProviderErrorCode.MODEL_NOT_FOUND;
    case 413:
      return ProviderErrorCode.CONTEXT_LENGTH_EXCEEDED;
    case 500:
    case 502:
    case 503:
      return ProviderErrorCode.SERVER_ERROR;
    case 504:
      return ProviderErrorCode.TIMEOUT;
    default:
      return ProviderErrorCode.UNKNOWN_ERROR;
  }
}

/**
 * Check if HTTP status code is retryable
 */
function isRetryableStatus(status: number): boolean {
  // Retry on rate limits, server errors, and timeouts
  return status === 429 || status === 503 || status === 504 || status >= 500;
}

/**
 * Extract retry-after header value (in seconds)
 */
function extractRetryAfter(headers: Record<string, string>): number | undefined {
  const retryAfter = headers["retry-after"] || headers["Retry-After"];
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (!Number.isNaN(seconds)) {
      return seconds;
    }
  }
  return undefined;
}

/**
 * Parse Gemini error response body
 */
function parseErrorBody(body: string): { message: string; status?: string } {
  try {
    const errorResponse = JSON.parse(body) as GeminiErrorResponse;
    const result: { message: string; status?: string } = {
      message: errorResponse.error.message,
    };
    if (errorResponse.error.status !== undefined) {
      result.status = errorResponse.error.status;
    }
    return result;
  } catch {
    return { message: body || "Unknown error" };
  }
}

/**
 * Create ProviderError from HTTP response
 *
 * Maps Gemini API errors to structured ProviderError instances
 */
export function createProviderErrorFromResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {}
): ProviderError {
  const errorCode = mapStatusToErrorCode(status);
  const isRetryable = isRetryableStatus(status);
  const retryAfter = extractRetryAfter(headers);
  const { message, status: errorStatus } = parseErrorBody(body);

  // Build user-friendly message
  let errorMessage = `Gemini API error (${status})`;

  if (errorStatus) {
    errorMessage += ` [${errorStatus}]`;
  }

  errorMessage += `: ${message}`;

  // Build options object, only including defined values
  const options: {
    statusCode: number;
    isRetryable: boolean;
    retryAfter?: number;
  } = {
    statusCode: status,
    isRetryable,
  };

  if (retryAfter !== undefined) {
    options.retryAfter = retryAfter;
  }

  return new ProviderError(errorCode, errorMessage, options);
}

/**
 * Create ProviderError from network error
 */
export function createProviderErrorFromNetworkError(
  error: Error
): ProviderError {
  if (error.message.includes("cancelled") || error.message.includes("abort")) {
    return new ProviderError(
      ProviderErrorCode.CANCELLED,
      "Request was cancelled",
      { cause: error }
    );
  }

  if (error.message.includes("timeout")) {
    return new ProviderError(
      ProviderErrorCode.TIMEOUT,
      "Request timed out. Please try again.",
      {
        isRetryable: true,
        cause: error,
      }
    );
  }

  return new ProviderError(
    ProviderErrorCode.NETWORK_ERROR,
    `Network error: ${error.message}`,
    {
      isRetryable: true,
      cause: error,
    }
  );
}
