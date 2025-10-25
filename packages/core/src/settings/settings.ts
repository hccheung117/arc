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
};
