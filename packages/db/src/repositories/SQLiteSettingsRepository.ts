import type { IPlatformDatabase } from "@arc/core/platform/IPlatformDatabase.js";
import type { ISettingsRepository } from "@arc/core/repositories/ISettingsRepository.js";

type SettingsRow = {
  key: string;
  value: string;
  updated_at: number;
};

export class SQLiteSettingsRepository implements ISettingsRepository {
  constructor(private readonly db: IPlatformDatabase) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await this.db.query<Pick<SettingsRow, "value">>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return JSON.parse(result.rows[0]!.value) as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const serializedValue = JSON.stringify(value);
    const now = Date.now();

    await this.db.exec(
      `INSERT OR REPLACE INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)`,
      [key, serializedValue, now]
    );
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.db.exec("DELETE FROM settings WHERE key = ?", [
      key,
    ]);
    return result.rowsAffected > 0;
  }

  async getAll<T = unknown>(): Promise<Record<string, T>> {
    const result = await this.db.query<SettingsRow>("SELECT * FROM settings");
    const settings: Record<string, T> = {};

    for (const row of result.rows) {
      settings[row.key] = JSON.parse(row.value) as T;
    }

    return settings;
  }

  async clear(): Promise<void> {
    await this.db.exec("DELETE FROM settings");
  }
}
