/**
 * Repository interface for application settings stored as key/value pairs.
 */
export interface SettingsRepository {
  /**
   * Get a setting by key.
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Persist or replace a setting value.
   */
  set<T = unknown>(key: string, value: T): Promise<void>;

  /**
   * Remove a setting entry.
   * @returns true if a value was removed.
   */
  delete(key: string): Promise<boolean>;

  /**
   * Retrieve the complete settings map.
   */
  getAll<T = unknown>(): Promise<Record<string, T>>;

  /**
   * Clear all settings.
   */
  clear(): Promise<void>;
}
