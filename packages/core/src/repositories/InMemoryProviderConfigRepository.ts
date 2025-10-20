import type { ProviderConfig } from "../domain/ProviderConfig.js";
import type { IProviderConfigRepository } from "./IProviderConfigRepository.js";

/**
 * In-memory implementation of IProviderConfigRepository
 *
 * For testing and development. Production should use SQLite or similar.
 */
export class InMemoryProviderConfigRepository
  implements IProviderConfigRepository
{
  private configs = new Map<string, ProviderConfig>();

  async create(config: ProviderConfig): Promise<ProviderConfig> {
    if (this.configs.has(config.id)) {
      throw new Error(`Provider config with id ${config.id} already exists`);
    }
    this.configs.set(config.id, { ...config });
    return config;
  }

  async findById(id: string): Promise<ProviderConfig | null> {
    const config = this.configs.get(id);
    return config ? { ...config } : null;
  }

  async findAll(): Promise<ProviderConfig[]> {
    return Array.from(this.configs.values()).map((config) => ({ ...config }));
  }

  async findEnabled(): Promise<ProviderConfig[]> {
    return Array.from(this.configs.values())
      .filter((config) => config.enabled)
      .map((config) => ({ ...config }));
  }

  async update(config: ProviderConfig): Promise<ProviderConfig> {
    if (!this.configs.has(config.id)) {
      throw new Error(`Provider config with id ${config.id} not found`);
    }
    this.configs.set(config.id, { ...config });
    return config;
  }

  async delete(id: string): Promise<boolean> {
    return this.configs.delete(id);
  }
}
