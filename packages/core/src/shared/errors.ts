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

  // Detection
  DETECTION_FAILED = "detection_failed",
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
      case ProviderErrorCode.DETECTION_FAILED:
        return "Unable to automatically detect provider type. Please specify the provider type manually.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }
}

/**
 * Error for provider auto-detection failures
 *
 * Wraps ProviderDetectionError from @arc/ai with user-friendly messaging
 * and actionable guidance for the UI layer.
 */
export class CoreProviderDetectionError extends ProviderError {
  /**
   * Evidence from detection attempts (sanitized, no sensitive data)
   */
  public readonly detectionAttempts: Array<{
    vendor: string;
    method: string;
    path: string;
    statusCode: number | null;
    evidence: string;
  }>;

  /**
   * Suggested action for the user
   */
  public readonly suggestedAction: "retry" | "manual_selection" | "check_connection";

  constructor(
    message: string,
    options: {
      isRetryable: boolean;
      detectionAttempts: Array<{
        vendor: string;
        method: string;
        path: string;
        statusCode: number | null;
        evidence: string;
      }>;
      cause?: Error;
    }
  ) {
    super(ProviderErrorCode.DETECTION_FAILED, message, {
      isRetryable: options.isRetryable,
      cause: options.cause,
    });
    this.name = "CoreProviderDetectionError";
    this.detectionAttempts = options.detectionAttempts;

    // Determine suggested action based on error characteristics
    if (options.isRetryable) {
      this.suggestedAction = "retry";
    } else if (options.detectionAttempts.length === 0) {
      // Heuristics failed, no probes attempted
      this.suggestedAction = "manual_selection";
    } else {
      // Probes ran but couldn't identify provider
      this.suggestedAction = "manual_selection";
    }
  }

  /**
   * Get detailed user message with actionable guidance
   */
  override getUserMessage(): string {
    switch (this.suggestedAction) {
      case "retry":
        return "Unable to detect provider type due to network issues. Please check your connection and try again.";
      case "manual_selection":
        return "Unable to automatically detect provider type. Please select your provider from the dropdown menu.";
      case "check_connection":
        return "Unable to detect provider type. Please check your API key and base URL, or select your provider manually.";
      default:
        return "Unable to automatically detect provider type. Please specify the provider type manually.";
    }
  }
}
