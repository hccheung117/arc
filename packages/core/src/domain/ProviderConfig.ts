/**
 * Supported AI provider types
 */
export type ProviderType = "openai" | "anthropic" | "gemini" | "custom";

/**
 * Provider configuration
 *
 * Stores API credentials and connection settings for AI providers
 */
export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string; // User-friendly name (e.g., "OpenAI GPT-4")

  /**
   * API key for authentication
   * Stored securely, should not be logged
   */
  apiKey: string;

  /**
   * Base URL for API requests
   * Allows custom endpoints and proxies
   *
   * Examples:
   * - OpenAI: "https://api.openai.com/v1"
   * - Custom proxy: "https://my-proxy.com/openai"
   */
  baseUrl: string;

  /**
   * Default model to use for completions
   * Can be overridden per-request
   */
  defaultModel?: string;

  /**
   * Additional headers for all requests
   * Useful for proxies, organization IDs, etc.
   */
  customHeaders?: Record<string, string>;

  /**
   * Whether this provider is currently enabled
   */
  enabled: boolean;

  createdAt: number;
  updatedAt: number;
}
