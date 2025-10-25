/**
 * Base platform error class
 *
 * All platform-specific errors inherit from this to allow
 * consumers to identify low-level I/O errors vs business logic errors.
 */
export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Network/HTTP-related errors
 *
 * Wraps native fetch errors, timeouts, or HTTP client failures.
 * Examples: connection refused, timeout, DNS failure, SSL errors.
 */
export class NetworkError extends PlatformError {
  constructor(
    message: string,
    public readonly url?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Database driver errors
 *
 * Wraps errors from the underlying database driver (better-sqlite3, sql.js, etc).
 * Examples: constraint violations, syntax errors, connection failures.
 */
export class DatabaseDriverError extends PlatformError {
  constructor(
    message: string,
    public readonly sql?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * File system errors
 *
 * Wraps errors from Node.js fs module or Capacitor filesystem plugin.
 * Examples: file not found, permission denied, disk full.
 */
export class FileSystemError extends PlatformError {
  constructor(
    message: string,
    public readonly path?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}
