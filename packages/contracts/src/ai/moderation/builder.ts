import type { ModerationResult } from './results.js';

/**
 * Fluent builder interface for content moderation
 *
 * Usage:
 * ```typescript
 * const result = await ai.moderation.check('text to moderate');
 * ```
 */
export interface IModerationBuilder {
  /**
   * Check content for policy violations
   *
   * @param content - Text content to moderate
   * @returns Promise that resolves to the moderation result
   */
  check(content: string): Promise<ModerationResult>;

  /**
   * Check content for policy violations (alias for check)
   *
   * @param content - Text content to moderate
   * @returns Promise that resolves to the moderation result
   */
  moderate(content: string): Promise<ModerationResult>;
}
