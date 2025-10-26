import type { Provider } from "@arc/ai/provider.type.js";
import type { ProviderConfig } from "./provider-config.js";
import type { ProviderRegistry } from "./provider-registry.js";
import type { IPlatformHTTP } from "@arc/platform";

/**
 * Manages the lifecycle of AI provider instances
 *
 * Responsible for:
 * - Creating provider instances from configurations
 * - Caching active providers
 * - Validating connections
 */
export class ProviderManager {
  private registry: ProviderRegistry;
  private http: IPlatformHTTP;
  private activeProviders = new Map<string, Provider>();

  constructor(registry: ProviderRegistry, http: IPlatformHTTP) {
    this.registry = registry;
    this.http = http;
  }

  /**
   * Get or create a provider instance from configuration
   *
   * @param config - Provider configuration
   * @returns Provider instance
   * @throws {Error} If provider type is not supported
   */
  getProvider(config: ProviderConfig): Provider {
    // Check cache first
    const cached = this.activeProviders.get(config.id);
    if (cached) {
      return cached;
    }

    // Build AIConfig with conditional optional properties
    const aiConfig: { apiKey: string; baseUrl?: string; customHeaders?: Record<string, string>; defaultMaxTokens?: number } = {
      apiKey: config.apiKey,
    };
    if (config.baseUrl) {
      aiConfig.baseUrl = config.baseUrl;
    }
    if (config.customHeaders) {
      aiConfig.customHeaders = config.customHeaders;
    }
    if (!config.defaultModel) {
      aiConfig.defaultMaxTokens = 4096;
    }

    // Create new instance
    const provider = this.registry.create(
      config.type,
      aiConfig,
      this.http
    );

    // Cache it
    this.activeProviders.set(config.id, provider);

    return provider;
  }

  /**
   * Check if a provider connection is valid
   *
   * @param config - Provider configuration to check
   * @returns true if connection is healthy
   * @throws Provider-specific errors for auth, network, etc.
   */
  async checkConnection(config: ProviderConfig): Promise<boolean> {
    const provider = this.getProvider(config);
    return provider.healthCheck();
  }

  /**
   * Remove a provider from the cache
   *
   * Call this when a provider configuration is updated or deleted
   */
  invalidate(configId: string): void {
    this.activeProviders.delete(configId);
  }

  /**
   * Clear all cached providers
   */
  clearCache(): void {
    this.activeProviders.clear();
  }
}
