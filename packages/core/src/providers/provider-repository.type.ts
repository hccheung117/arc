import type { ProviderConfig } from "./provider-config.js";

/**
 * Repository interface for ProviderConfig persistence
 */
export interface ProviderConfigRepository {
  /**
   * Create a new provider configuration
   */
  create(config: ProviderConfig): Promise<ProviderConfig>;

  /**
   * Find a provider config by ID
   */
  findById(id: string): Promise<ProviderConfig | null>;

  /**
   * Find all provider configurations
   */
  findAll(): Promise<ProviderConfig[]>;

  /**
   * Find all enabled provider configurations
   */
  findEnabled(): Promise<ProviderConfig[]>;

  /**
   * Update a provider configuration
   */
  update(config: ProviderConfig): Promise<ProviderConfig>;

  /**
   * Delete a provider configuration
   */
  delete(id: string): Promise<boolean>;
}
