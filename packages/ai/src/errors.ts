/**
 * Base error class for all AI-related errors
 *
 * This is the root of the AI error hierarchy. All provider-specific
 * errors should extend from this base class.
 */
export class AIError extends Error {
  /**
   * Indicates whether this error is transient and safe to retry
   */
  public readonly isRetryable: boolean;

  /**
   * Optional retry backoff duration in seconds
   * Only relevant for retryable errors
   */
  public readonly retryAfter?: number;

  /**
   * Optional HTTP status code if this error originated from an HTTP response
   */
  public readonly statusCode?: number;

  /**
   * Optional underlying cause of this error
   */
  public override readonly cause?: Error;

  constructor(
    message: string,
    options?: {
      isRetryable?: boolean;
      retryAfter?: number;
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "AIError";
    this.isRetryable = options?.isRetryable ?? false;
    this.retryAfter = options?.retryAfter;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Authentication error - invalid API key or credentials
 *
 * **Non-retryable**: The user must provide valid credentials.
 */
export class ProviderAuthError extends AIError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: false,
    });
    this.name = "ProviderAuthError";
  }
}

/**
 * Rate limit exceeded error
 *
 * **Retryable**: The provider has rate-limited the request.
 * Includes optional backoff metadata from the provider.
 */
export class ProviderRateLimitError extends AIError {
  constructor(
    message: string,
    options?: {
      retryAfter?: number;
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: true,
    });
    this.name = "ProviderRateLimitError";
  }
}

/**
 * Network timeout error
 *
 * **Retryable**: A transient network issue that can be safely retried.
 */
export class ProviderTimeoutError extends AIError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: true,
    });
    this.name = "ProviderTimeoutError";
  }
}

/**
 * Quota exceeded error - user has exhausted their provider quota
 *
 * **Non-retryable**: The user must upgrade their plan or wait for quota reset.
 */
export class ProviderQuotaExceededError extends AIError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: false,
    });
    this.name = "ProviderQuotaExceededError";
  }
}

/**
 * Model not found error - the specified model does not exist
 *
 * **Non-retryable**: The user must specify a valid model.
 */
export class ModelNotFoundError extends AIError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: false,
    });
    this.name = "ModelNotFoundError";
  }
}

/**
 * Provider server error - internal error on the provider's side
 *
 * **Retryable**: A temporary server issue that may resolve on retry.
 */
export class ProviderServerError extends AIError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: true,
    });
    this.name = "ProviderServerError";
  }
}

/**
 * Invalid request error - the request parameters are invalid
 *
 * **Non-retryable**: The user must fix the request parameters.
 */
export class ProviderInvalidRequestError extends AIError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: false,
    });
    this.name = "ProviderInvalidRequestError";
  }
}

/**
 * Request cancelled error - the request was explicitly cancelled
 *
 * **Non-retryable**: Cancellation is intentional.
 */
export class RequestCancelledError extends AIError {
  constructor(
    message: string = "Request was cancelled",
    options?: {
      cause?: Error;
    }
  ) {
    super(message, {
      ...options,
      isRetryable: false,
    });
    this.name = "RequestCancelledError";
  }
}
