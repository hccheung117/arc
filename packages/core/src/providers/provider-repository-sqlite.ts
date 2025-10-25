import type { ProviderConfig } from "./provider-config.js";
import type { IProviderConfigRepository } from "./provider-repository.type.js";
import type { IPlatformDatabase } from "@arc/platform";
import type { ProviderConnection } from "@arc/db/schema.js";

/**
 * SQLite implementation of IProviderConfigRepository
 *
 * Uses the platform database to persist provider configurations
 */
export class SQLiteProviderConfigRepository implements IProviderConfigRepository {
  private db: IPlatformDatabase;

  constructor(db: IPlatformDatabase) {
    this.db = db;
  }

  async create(config: ProviderConfig): Promise<ProviderConfig> {
    const row: Omit<ProviderConnection, "id"> & { id: string } = {
      id: config.id,
      name: config.name,
      provider_type: config.type,
      api_key: config.apiKey,
      base_url: config.baseUrl,
      custom_headers: config.customHeaders
        ? JSON.stringify(config.customHeaders)
        : null,
      is_active: config.enabled ? 1 : 0,
      created_at: config.createdAt,
      updated_at: config.updatedAt,
    };

    await this.db.exec(
      `INSERT INTO provider_connections (
        id, name, provider_type, api_key, base_url,
        custom_headers, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.provider_type,
        row.api_key,
        row.base_url,
        row.custom_headers,
        row.is_active,
        row.created_at,
        row.updated_at,
      ]
    );

    return config;
  }

  async findById(id: string): Promise<ProviderConfig | null> {
    const result = await this.db.query<ProviderConnection & Record<string, unknown>>(
      `SELECT * FROM provider_connections WHERE id = ?`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.toConfig(result.rows[0]!);
  }

  async findAll(): Promise<ProviderConfig[]> {
    const result = await this.db.query<ProviderConnection & Record<string, unknown>>(
      `SELECT * FROM provider_connections ORDER BY created_at DESC`
    );

    return result.rows.map((row) => this.toConfig(row));
  }

  async findEnabled(): Promise<ProviderConfig[]> {
    const result = await this.db.query<ProviderConnection & Record<string, unknown>>(
      `SELECT * FROM provider_connections WHERE is_active = 1 ORDER BY created_at DESC`
    );

    return result.rows.map((row) => this.toConfig(row));
  }

  async update(config: ProviderConfig): Promise<ProviderConfig> {
    const result = await this.db.exec(
      `UPDATE provider_connections
       SET name = ?, api_key = ?, base_url = ?,
           custom_headers = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        config.name,
        config.apiKey,
        config.baseUrl,
        config.customHeaders ? JSON.stringify(config.customHeaders) : null,
        config.enabled ? 1 : 0,
        config.updatedAt,
        config.id,
      ]
    );

    if (result.rowsAffected === 0) {
      throw new Error(`Provider config with id ${config.id} not found`);
    }

    return config;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.exec(
      `DELETE FROM provider_connections WHERE id = ?`,
      [id]
    );

    return result.rowsAffected > 0;
  }

  /**
   * Convert database row to ProviderConfig domain object
   */
  private toConfig(row: ProviderConnection): ProviderConfig {
    const config: ProviderConfig = {
      id: row.id,
      name: row.name,
      type: row.provider_type,
      apiKey: row.api_key,
      baseUrl: row.base_url ?? "",
      enabled: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Conditionally add optional properties to satisfy exactOptionalPropertyTypes
    if (row.custom_headers) {
      config.customHeaders = JSON.parse(row.custom_headers);
    }

    // defaultModel is not stored in DB yet, so we omit it entirely

    return config;
  }
}
