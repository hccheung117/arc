/**
 * Generic interface for atomic file operations.
 * Used for Config and Ledger archetypes where the entire file is read/written atomically.
 */
export interface IJsonFile<T> {
  /**
   * Reads the entire file and returns the parsed JSON data.
   * Returns the default value if the file doesn't exist or cannot be parsed.
   */
  read(): Promise<T>

  /**
   * Atomically writes the data to the file using write-replace strategy.
   * Creates parent directories if they don't exist.
   */
  write(data: T): Promise<void>

  /**
   * Read-modify-write helper that ensures consistency.
   * Passes the current data to the updater function and writes the result back atomically.
   */
  update(updater: (data: T) => T): Promise<void>
}

/**
 * Generic interface for append-only log operations.
 * Used for Stream archetype where data is appended chronologically.
 */
export interface IJsonLog<T> {
  /**
   * Appends a single item to the log as a JSON line.
   * Creates the file and parent directories if they don't exist.
   */
  append(item: T): Promise<void>

  /**
   * Reads all lines from the log and returns them as an array.
   * Returns an empty array if the file doesn't exist.
   * Filters empty lines and handles parse errors gracefully.
   */
  read(): Promise<T[]>

  /**
   * Deletes the log file.
   * Succeeds silently if the file doesn't exist.
   */
  delete(): Promise<void>
}
