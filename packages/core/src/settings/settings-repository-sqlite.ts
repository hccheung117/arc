import type { SettingsRepository } from "./settings-repository.type.js";
import type { PlatformDatabase } from "@arc/platform";
import type { Setting } from "@arc/db/schema.js";

/**
 * SQLite implementation of SettingsRepository
 *
 * Persists settings to the SQLite database using the platform database driver.
 */
export class SQLiteSettingsRepository implements SettingsRepository {
  private db: PlatformDatabase;

  constructor(db: PlatformDatabase) {
    this.db = db;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await this.db.query<Setting & Record<string, unknown>>(
      `SELECT * FROM settings WHERE key = ?`,
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return JSON.parse(result.rows[0]!.value) as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const now = Date.now();
    const jsonValue = JSON.stringify(value);

    // Upsert (insert or replace)
    await this.db.exec(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, jsonValue, now]
    );
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.db.exec(
      `DELETE FROM settings WHERE key = ?`,
      [key]
    );

    return result.rowsAffected > 0;
  }

  async getAll<T = unknown>(): Promise<Record<string, T>> {
    const result = await this.db.query<Setting & Record<string, unknown>>(
      `SELECT * FROM settings`
    );

    const settings: Record<string, T> = {};
    for (const row of result.rows) {
      settings[row.key] = JSON.parse(row.value) as T;
    }

    return settings;
  }

  async clear(): Promise<void> {
    await this.db.exec(`DELETE FROM settings`);
  }
}
