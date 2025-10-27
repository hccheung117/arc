/**
 * Error handling utilities for classifying and handling Core API errors
 * Adheres to Arc's error handling strategy: retry-able vs non-retryable classification
 */

export interface ErrorDetails {
  message: string;
  isRetryable: boolean;
  originalError?: unknown;
}

/**
 * Classifies errors from @arc/core into retry-able vs non-retryable categories
 *
 * Retry-able errors: Network timeouts, rate limits, transient failures
 * Non-retryable errors: Validation errors, not found, invalid credentials
 */
export function classifyError(error: unknown): ErrorDetails {
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network and transient errors (retry-able)
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('fetch failed')
    ) {
      return {
        message: error.message,
        isRetryable: true,
        originalError: error,
      };
    }

    // Validation and permanent errors (non-retryable)
    if (
      message.includes('not found') ||
      message.includes('invalid') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('validation')
    ) {
      return {
        message: error.message,
        isRetryable: false,
        originalError: error,
      };
    }

    // Default: treat unknown errors as non-retryable for safety
    return {
      message: error.message,
      isRetryable: false,
      originalError: error,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      isRetryable: false,
      originalError: error,
    };
  }

  // Handle unknown error types
  return {
    message: 'An unexpected error occurred',
    isRetryable: false,
    originalError: error,
  };
}

/**
 * Formats error messages for user-friendly display
 */
export function formatErrorMessage(error: unknown): string {
  const details = classifyError(error);
  return details.message;
}

/**
 * Creates a user-actionable error message with retry guidance
 */
export function createErrorToastMessage(error: unknown): {
  title: string;
  description: string;
  isRetryable: boolean;
} {
  const details = classifyError(error);

  if (details.isRetryable) {
    return {
      title: 'Temporary Error',
      description: details.message,
      isRetryable: true,
    };
  }

  return {
    title: 'Error',
    description: details.message,
    isRetryable: false,
  };
}
