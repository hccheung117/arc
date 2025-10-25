import type { ProviderConfig } from "./provider-config.js";
import type { IProviderConfigRepository } from "./provider-repository.type.js";
import type { ProviderManager } from "./provider-manager.js";
import { generateId } from "../shared/id-generator.js";

/**
 * Input for creating a new provider
 */
export interface CreateProviderInput {
  name: string;
  type: "openai" | "anthropic" | "gemini" | "custom";
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
  private repository: IProviderConfigRepository;
  private manager: ProviderManager;

  constructor(repository: IProviderConfigRepository, manager: ProviderManager) {
    this.repository = repository;
    this.manager = manager;
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
    const now = Date.now();
    const config: ProviderConfig = {
      id: generateId(),
      name: input.name,
      type: input.type,
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
}
