/**
 * Database error types for @arc/db
 *
 * Provides structured error handling with classification for retry logic.
 * Errors propagate from the database layer to be caught and wrapped by Core.
 */

/**
 * Base class for all database errors.
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when the database connection cannot be established.
 * This is retry-able on startup only.
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, true);
  }
}

/**
 * Thrown when a schema migration fails.
 * This is non-retry-able and indicates a corrupt or inconsistent state.
 */
export class MigrationError extends DatabaseError {
  constructor(
    message: string,
    public readonly migrationName: string,
    cause?: unknown
  ) {
    super(message, cause, false);
  }
}

/**
 * Thrown when a query execution fails.
 * This is non-retry-able as it typically indicates a logic or constraint error.
 */
export class QueryError extends DatabaseError {
  constructor(
    message: string,
    public readonly sql?: string,
    cause?: unknown
  ) {
    super(message, cause, false);
  }
}
