import type { Provider, AIConfig, ProviderType } from "@arc/ai/provider.js";
import type { IPlatformHTTP } from "@arc/platform";

/**
 * Factory function type for creating provider instances
 */
export type ProviderFactory = (config: AIConfig, http: IPlatformHTTP) => Provider;

/**
 * Internal registry of available AI provider types
 *
 * Maps provider type strings to their factory functions.
 * This allows the Core to instantiate providers without
 * directly depending on their concrete implementations.
 */
export class ProviderRegistry {
  private factories = new Map<ProviderType, ProviderFactory>();

  /**
   * Register a provider factory
   */
  register(type: ProviderType, factory: ProviderFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Check if a provider type is registered
   */
  has(type: ProviderType): boolean {
    return this.factories.has(type);
  }

  /**
   * Create a provider instance
   *
   * @throws {Error} If provider type is not registered
   */
  create(type: ProviderType, config: AIConfig, http: IPlatformHTTP): Provider {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Provider type "${type}" is not registered`);
    }
    return factory(config, http);
  }

  /**
   * Get all registered provider types
   */
  getTypes(): ProviderType[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Create and initialize the default provider registry
 * with built-in providers (OpenAI, Anthropic, Gemini)
 */
export function createDefaultRegistry(http: IPlatformHTTP): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register built-in providers
  // Note: We use dynamic imports to avoid bundling all providers
  // These imports will be resolved at runtime

  registry.register("openai", (config) => {
    // Lazy import of OpenAI provider
    const { OpenAIProvider } = require("@arc/ai/providers/openai.js");
    return new OpenAIProvider(http, config);
  });

  registry.register("anthropic", (config) => {
    // Lazy import of Anthropic provider
    const { AnthropicProvider } = require("@arc/ai/providers/anthropic.js");
    return new AnthropicProvider(http, config);
  });

  registry.register("gemini", (config) => {
    // Lazy import of Gemini provider
    const { GeminiProvider } = require("@arc/ai/providers/gemini.js");
    return new GeminiProvider(http, config);
  });

  return registry;
}
