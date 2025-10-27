/**
 * Error handling utilities for classifying and handling Core API errors
 * Adheres to Arc's error handling strategy: retry-able vs non-retryable classification
 */

/**
 * Toast severity levels for consistent UX
 */
export type ToastSeverity = "info" | "success" | "warning" | "error";

/**
 * Toast duration constants (in milliseconds)
 */
export const TOAST_DURATION = {
  /** Quick notifications (3 seconds) */
  short: 3000,
  /** Standard notifications (5 seconds) */
  standard: 5000,
  /** Important messages (8 seconds) */
  long: 8000,
  /** Indefinite - requires user action */
  indefinite: Infinity,
} as const;

export interface ErrorDetails {
  message: string;
  isRetryable: boolean;
  originalError?: unknown;
  severity: ToastSeverity;
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
        severity: 'warning',
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
        severity: 'error',
      };
    }

    // Default: treat unknown errors as non-retryable for safety
    return {
      message: error.message,
      isRetryable: false,
      originalError: error,
      severity: 'error',
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      isRetryable: false,
      originalError: error,
      severity: 'error',
    };
  }

  // Handle unknown error types
  return {
    message: 'An unexpected error occurred',
    isRetryable: false,
    originalError: error,
    severity: 'error',
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
  severity: ToastSeverity;
} {
  const details = classifyError(error);

  if (details.isRetryable) {
    return {
      title: 'Temporary Error',
      description: details.message,
      isRetryable: true,
      severity: details.severity,
    };
  }

  return {
    title: 'Error',
    description: details.message,
    isRetryable: false,
    severity: details.severity,
  };
}

/**
 * Get appropriate toast duration based on severity and retry-ability
 */
export function getToastDuration(severity: ToastSeverity, hasAction: boolean): number {
  // Toasts with actions (e.g., retry buttons) should stay longer or indefinitely
  if (hasAction) {
    return TOAST_DURATION.indefinite;
  }

  // Map severity to duration
  switch (severity) {
    case 'info':
    case 'success':
      return TOAST_DURATION.short; // 3 seconds
    case 'warning':
      return TOAST_DURATION.standard; // 5 seconds
    case 'error':
      return TOAST_DURATION.long; // 8 seconds
    default:
      return TOAST_DURATION.standard;
  }
}
