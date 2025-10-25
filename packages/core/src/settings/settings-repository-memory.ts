import type { ISettingsRepository } from "./settings-repository.type.js";

/**
 * In-memory implementation of ISettingsRepository
 *
 * Stores settings in a Map. Suitable for testing and single-session usage.
 */
export class InMemorySettingsRepository implements ISettingsRepository {
  private settings = new Map<string, string>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = this.settings.get(key);
    if (value === undefined) {
      return null;
    }
    return JSON.parse(value) as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.settings.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.settings.delete(key);
  }

  async getAll<T = unknown>(): Promise<Record<string, T>> {
    const result: Record<string, T> = {};
    for (const [key, value] of this.settings.entries()) {
      result[key] = JSON.parse(value) as T;
    }
    return result;
  }

  async clear(): Promise<void> {
    this.settings.clear();
  }
}
