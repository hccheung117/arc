/**
 * Application settings
 *
 * Defines the structure of user preferences and configuration.
 */
export interface Settings {
  /**
   * Theme preference
   */
  theme: "light" | "dark" | "system";

  /**
   * Default model to use for new chats
   */
  defaultModel?: string;

  /**
   * Default provider connection ID
   */
  defaultProviderConnectionId?: string;

  /**
   * Font size for chat messages
   */
  fontSize: "small" | "medium" | "large";

  /**
   * Whether to show token counts
   */
  showTokenCounts: boolean;

  /**
   * Whether to enable markdown rendering
   */
  enableMarkdown: boolean;

  /**
   * Whether to enable code syntax highlighting
   */
  enableSyntaxHighlighting: boolean;

  /**
   * Favorite models for quick access
   * Format: "providerId:modelId"
   */
  favoriteModels: string[];

  /**
   * Whitelisted models to show in model selector
   * Format: "providerId:modelId"
   * Empty array means show all models
   */
  whitelistedModels: string[];

  /**
   * Line height for chat messages
   */
  lineHeight: "compact" | "normal" | "relaxed";

  /**
   * Font family for chat messages
   */
  fontFamily: "sans" | "serif" | "mono";

  /**
   * Default system prompt for new chats
   */
  defaultSystemPrompt?: string;

  /**
   * Whether to automatically generate chat titles
   */
  autoTitleChats: boolean;

  /**
   * Default temperature for new chats
   * Range: 0-2 (0 = deterministic, 2 = very creative)
   */
  defaultTemperature?: number;
}

/**
 * Default settings
 */
export const defaultSettings: Settings = {
  theme: "system",
  fontSize: "medium",
  showTokenCounts: false,
  enableMarkdown: true,
  enableSyntaxHighlighting: true,
  favoriteModels: [],
  whitelistedModels: [],
  lineHeight: "normal",
  fontFamily: "sans",
  autoTitleChats: true,
  defaultTemperature: 1.0,
};
