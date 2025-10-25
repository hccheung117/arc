/**
 * Error codes for provider operations
 */
export enum ProviderErrorCode {
  // Authentication errors
  INVALID_API_KEY = "invalid_api_key",
  EXPIRED_API_KEY = "expired_api_key",
  INSUFFICIENT_QUOTA = "insufficient_quota",

  // Rate limiting
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  QUOTA_EXCEEDED = "quota_exceeded",

  // Request errors
  INVALID_REQUEST = "invalid_request",
  MODEL_NOT_FOUND = "model_not_found",
  CONTEXT_LENGTH_EXCEEDED = "context_length_exceeded",

  // Network errors
  NETWORK_ERROR = "network_error",
  TIMEOUT = "timeout",
  CONNECTION_FAILED = "connection_failed",

  // Server errors
  SERVER_ERROR = "server_error",
  SERVICE_UNAVAILABLE = "service_unavailable",

  // Other
  UNKNOWN_ERROR = "unknown_error",
  CANCELLED = "cancelled",
}

/**
 * Structured error for provider operations
 *
 * Provides user-friendly error messages and retry guidance
 */
export class ProviderError extends Error {
  code: ProviderErrorCode;
  statusCode?: number;
  isRetryable: boolean;
  retryAfter?: number; // seconds to wait before retry

  constructor(
    code: ProviderErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      isRetryable?: boolean;
      retryAfter?: number;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.isRetryable = options?.isRetryable ?? false;

    // Only assign optional properties if they're defined
    if (options?.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    if (options?.retryAfter !== undefined) {
      this.retryAfter = options.retryAfter;
    }
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case ProviderErrorCode.INVALID_API_KEY:
        return "Invalid API key. Please check your settings and try again.";
      case ProviderErrorCode.EXPIRED_API_KEY:
        return "API key has expired. Please update your settings.";
      case ProviderErrorCode.INSUFFICIENT_QUOTA:
        return "Insufficient API quota. Please check your account or upgrade your plan.";
      case ProviderErrorCode.RATE_LIMIT_EXCEEDED:
        return this.retryAfter
          ? `Rate limit exceeded. Please wait ${this.retryAfter} seconds and try again.`
          : "Rate limit exceeded. Please wait a moment and try again.";
      case ProviderErrorCode.QUOTA_EXCEEDED:
        return "API quota exceeded. Please check your account limits.";
      case ProviderErrorCode.MODEL_NOT_FOUND:
        return "Selected model not found. Please choose a different model.";
      case ProviderErrorCode.CONTEXT_LENGTH_EXCEEDED:
        return "Message is too long. Please reduce the length and try again.";
      case ProviderErrorCode.NETWORK_ERROR:
        return "Network error. Please check your connection and try again.";
      case ProviderErrorCode.TIMEOUT:
        return "Request timed out. Please try again.";
      case ProviderErrorCode.CONNECTION_FAILED:
        return "Failed to connect to the service. Please try again later.";
      case ProviderErrorCode.SERVER_ERROR:
        return "Server error. Please try again later.";
      case ProviderErrorCode.SERVICE_UNAVAILABLE:
        return "Service is temporarily unavailable. Please try again later.";
      case ProviderErrorCode.CANCELLED:
        return "Request was cancelled.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }
}
