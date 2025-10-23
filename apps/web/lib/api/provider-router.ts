import type { IProvider, ModelInfo, ProviderCapabilities } from "@arc/contracts/IProvider.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import { OpenAIProvider } from "@arc/ai/openai/OpenAIProvider.js";
import { AnthropicProvider } from "@arc/ai/anthropic/AnthropicProvider.js";
import { GeminiProvider } from "@arc/ai/gemini/GeminiProvider.js";

/**
 * ProviderRouter - Routes requests to the appropriate provider based on model ID
 *
 * This allows ChatService to work with multiple providers transparently.
 * It maintains a mapping of model IDs to their providers and routes all
 * IProvider interface calls to the correct underlying provider.
 */
export class ProviderRouter implements IProvider {
  private providers: Map<string, OpenAIProvider | AnthropicProvider | GeminiProvider>;
  private modelToProvider: Map<string, string>;  // model ID -> provider type
  private defaultProvider: IProvider;

  constructor(
    providers: Map<string, OpenAIProvider | AnthropicProvider | GeminiProvider>,
    defaultProviderType: string
  ) {
    this.providers = providers;
    this.modelToProvider = new Map();

    const defaultProv = providers.get(defaultProviderType);
    if (!defaultProv) {
      throw new Error(`Default provider ${defaultProviderType} not found`);
    }
    this.defaultProvider = defaultProv;
  }

  /**
   * Update the model-to-provider mapping
   * Should be called after fetching models from providers
   */
  updateModelMapping(models: Array<{ id: string; provider: string }>) {
    for (const model of models) {
      this.modelToProvider.set(model.id, model.provider);
    }
  }

  /**
   * Get the provider for a specific model
   */
  private getProviderForModel(model: string): IProvider {
    const providerType = this.modelToProvider.get(model);
    if (!providerType) {
      console.warn(`Provider for model ${model} not found, using default provider`);
      return this.defaultProvider;
    }

    const provider = this.providers.get(providerType);
    if (!provider) {
      console.warn(`Provider ${providerType} not found, using default provider`);
      return this.defaultProvider;
    }

    return provider;
  }

  // ==================== IProvider Implementation ====================

  async listModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];

    for (const provider of this.providers.values()) {
      try {
        const models = await provider.listModels();
        allModels.push(...models);
      } catch (error) {
        console.warn("Failed to list models from provider:", error);
      }
    }

    return allModels;
  }

  async healthCheck(): Promise<boolean> {
    // Check all providers
    const results = await Promise.allSettled(
      Array.from(this.providers.values()).map(p => p.healthCheck())
    );

    // Return true if at least one provider is healthy
    return results.some(r => r.status === "fulfilled" && r.value === true);
  }

  async *streamChatCompletion(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    model: string,
    attachments?: ImageAttachment[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, undefined> {
    const provider = this.getProviderForModel(model);
    yield* provider.streamChatCompletion(messages, model, attachments, signal);
  }

  getCapabilities(model: string): ProviderCapabilities {
    const provider = this.getProviderForModel(model);
    return provider.getCapabilities(model);
  }
}
