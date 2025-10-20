import type {
  IPlatformDatabase,
  IProviderConfigRepository,
  ProviderConfig,
} from "@arc/core";

type ProviderConfigRow = {
  id: string;
  type: ProviderConfig["type"];
  name: string;
  api_key: string;
  base_url: string;
  default_model: string | null;
  custom_headers: string | null;
  enabled: number;
  created_at: number;
  updated_at: number;
};

export class SQLiteProviderConfigRepository
  implements IProviderConfigRepository
{
  constructor(private readonly db: IPlatformDatabase) {}

  async create(config: ProviderConfig): Promise<ProviderConfig> {
    await this.db.exec(
      `INSERT INTO provider_configs (id, type, name, api_key, base_url, default_model, custom_headers, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.id,
        config.type,
        config.name,
        config.apiKey,
        config.baseUrl,
        config.defaultModel ?? null,
        config.customHeaders ? JSON.stringify(config.customHeaders) : null,
        config.enabled ? 1 : 0,
        config.createdAt,
        config.updatedAt,
      ]
    );
    return config;
  }

  async findById(id: string): Promise<ProviderConfig | null> {
    const result = await this.db.query<ProviderConfigRow>(
      "SELECT * FROM provider_configs WHERE id = ?",
      [id]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.rowToConfig(result.rows[0]!);
  }

  async findAll(): Promise<ProviderConfig[]> {
    const result = await this.db.query<ProviderConfigRow>(
      "SELECT * FROM provider_configs ORDER BY created_at ASC"
    );
    return result.rows.map((row) => this.rowToConfig(row));
  }

  async findEnabled(): Promise<ProviderConfig[]> {
    const result = await this.db.query<ProviderConfigRow>(
      "SELECT * FROM provider_configs WHERE enabled = 1 ORDER BY created_at ASC"
    );
    return result.rows.map((row) => this.rowToConfig(row));
  }

  async update(config: ProviderConfig): Promise<ProviderConfig> {
    await this.db.exec(
      `UPDATE provider_configs
       SET type = ?, name = ?, api_key = ?, base_url = ?, default_model = ?,
           custom_headers = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
      [
        config.type,
        config.name,
        config.apiKey,
        config.baseUrl,
        config.defaultModel ?? null,
        config.customHeaders ? JSON.stringify(config.customHeaders) : null,
        config.enabled ? 1 : 0,
        config.updatedAt,
        config.id,
      ]
    );
    return config;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.exec(
      "DELETE FROM provider_configs WHERE id = ?",
      [id]
    );
    return result.rowsAffected > 0;
  }

  private rowToConfig(row: ProviderConfigRow): ProviderConfig {
    const config: ProviderConfig = {
      id: row.id,
      type: row.type,
      name: row.name,
      apiKey: row.api_key,
      baseUrl: row.base_url,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (row.default_model !== null) {
      config.defaultModel = row.default_model;
    }

    if (row.custom_headers !== null) {
      config.customHeaders = JSON.parse(row.custom_headers) as Record<
        string,
        string
      >;
    }

    return config;
  }
}
