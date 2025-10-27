import type { ProviderConfig } from "./provider-config.js";
import type { ProviderConfigRepository } from "./provider-repository.type.js";
import type { ProviderManager } from "./provider-manager.js";
import type { ModelInfo } from "@arc/ai/provider.type.js";
import { generateId } from "../shared/id-generator.js";
import { detectProviderType, detectProviderTypeFromProbe } from "@arc/ai/provider-detector.js";
import { ProviderDetectionError } from "@arc/ai/errors.js";
import { CoreProviderDetectionError } from "../shared/errors.js";

/**
 * Input for creating a new provider
 */
export interface CreateProviderInput {
  name: string;
  type: "openai" | "anthropic" | "gemini" | "custom" | "auto";
  apiKey: string;
  baseUrl: string;
  customHeaders?: Record<string, string>;
  defaultModel?: string;
  enabled?: boolean;
}

/**
 * Input for updating a provider
 */
export interface UpdateProviderInput {
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
  defaultModel?: string;
  enabled?: boolean;
}

/**
 * Public API for managing AI provider connections
 *
 * Handles CRUD operations for provider configurations
 * and validates connections.
 */
export class ProvidersAPI {
  private repository: ProviderConfigRepository;
  private manager: ProviderManager;

  /**
   * Cache for provider type detection results
   * Key: hash of (baseUrl, apiKey), Value: detected provider type
   *
   * This cache prevents redundant network probes when the same
   * credentials are tested multiple times.
   */
  private detectionCache: Map<string, "openai" | "anthropic" | "gemini" | "custom">;

  constructor(repository: ProviderConfigRepository, manager: ProviderManager) {
    this.repository = repository;
    this.manager = manager;
    this.detectionCache = new Map();
  }

  /**
   * Generate a cache key from API credentials
   * Uses a simple hash function for cache key generation
   */
  private generateCacheKey(apiKey: string, baseUrl: string): string {
    // Simple hash function - not cryptographic, just for cache key
    const input = `${baseUrl}::${apiKey}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear the detection cache
   * Useful for testing or when credentials change
   */
  clearDetectionCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Get all configured provider instances
   */
  async list(): Promise<ProviderConfig[]> {
    return this.repository.findAll();
  }

  /**
   * Add a new provider connection
   */
  async create(input: CreateProviderInput): Promise<ProviderConfig> {
    // Detect provider type if "auto" is specified
    let providerType: "openai" | "anthropic" | "gemini" | "custom";

    if (input.type === "auto") {
      // Check cache first
      const cacheKey = this.generateCacheKey(input.apiKey, input.baseUrl);
      const cachedType = this.detectionCache.get(cacheKey);

      if (cachedType) {
        providerType = cachedType;
      } else {
        // Cache miss - perform detection
        let usedNetworkProbe = false;
        try {
          // Phase 1: Try fast heuristics first
          providerType = detectProviderType({
            apiKey: input.apiKey,
            baseUrl: input.baseUrl,
          });
        } catch (heuristicError) {
          if (heuristicError instanceof ProviderDetectionError) {
            try {
              // Phase 2: Fall back to network probing
              usedNetworkProbe = true;
              providerType = await detectProviderTypeFromProbe({
                apiKey: input.apiKey,
                baseUrl: input.baseUrl,
              });
            } catch (probeError) {
              if (probeError instanceof ProviderDetectionError) {
                // Both phases failed - wrap in CoreError with user-friendly message
                throw new CoreProviderDetectionError(
                  probeError.message,
                  {
                    isRetryable: probeError.isRetryable,
                    detectionAttempts: probeError.attempts,
                    cause: probeError,
                  }
                );
              }
              throw probeError;
            }
          } else {
            throw heuristicError;
          }
        }

        // Only cache network probe results (not heuristic results)
        // Heuristics are fast enough to run every time
        if (usedNetworkProbe) {
          this.detectionCache.set(cacheKey, providerType);
        }
      }
    } else {
      providerType = input.type;
    }

    const now = Date.now();
    const config: ProviderConfig = {
      id: generateId(),
      name: input.name,
      type: providerType,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    // Conditionally add optional properties to satisfy exactOptionalPropertyTypes
    if (input.customHeaders) {
      config.customHeaders = input.customHeaders;
    }
    if (input.defaultModel) {
      config.defaultModel = input.defaultModel;
    }

    await this.repository.create(config);
    return config;
  }

  /**
   * Update an existing provider's settings
   */
  async update(id: string, input: UpdateProviderInput): Promise<ProviderConfig> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Provider ${id} not found`);
    }

    // Invalidate detection cache if credentials changed
    if (input.apiKey !== undefined || input.baseUrl !== undefined) {
      const cacheKey = this.generateCacheKey(existing.apiKey, existing.baseUrl);
      this.detectionCache.delete(cacheKey);
    }

    const updated: ProviderConfig = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
      ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
      ...(input.customHeaders !== undefined && { customHeaders: input.customHeaders }),
      ...(input.defaultModel !== undefined && { defaultModel: input.defaultModel }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      updatedAt: Date.now(),
    };

    await this.repository.update(updated);

    // Invalidate cached provider instance
    this.manager.invalidate(id);

    return updated;
  }

  /**
   * Remove a provider connection
   */
  async delete(id: string): Promise<void> {
    // Get existing config to invalidate detection cache
    const existing = await this.repository.findById(id);
    if (existing) {
      const cacheKey = this.generateCacheKey(existing.apiKey, existing.baseUrl);
      this.detectionCache.delete(cacheKey);
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error(`Provider ${id} not found`);
    }

    // Invalidate cached provider instance
    this.manager.invalidate(id);
  }

  /**
   * Validate a provider's API key and connection status
   *
   * @returns true if connection is valid
   * @throws Provider-specific errors (auth, network, etc.)
   */
  async checkConnection(id: string): Promise<boolean> {
    const config = await this.repository.findById(id);
    if (!config) {
      throw new Error(`Provider ${id} not found`);
    }

    return this.manager.checkConnection(config);
  }

  /**
   * Get available models from a provider
   *
   * @param id - Provider configuration ID
   * @returns Array of available models
   * @throws Provider-specific errors (auth, network, etc.)
   */
  async getModels(id: string): Promise<ModelInfo[]> {
    const config = await this.repository.findById(id);
    if (!config) {
      throw new Error(`Provider ${id} not found`);
    }

    const provider = await this.manager.getProvider(config);
    return provider.listModels();
  }
}
