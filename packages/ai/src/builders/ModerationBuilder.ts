import type { IModerationBuilder } from '@arc/contracts/ai/ModerationBuilder.js';
import type { ModerationResult } from '@arc/contracts/ai/Results.js';
import type { Provider } from '@arc/contracts/ai/Metadata.js';

/**
 * Provider interface for moderation
 * This will be implemented by provider adapters
 */
export interface IModerationProvider {
  moderate(content: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }>;
}

/**
 * Fluent moderation builder implementation
 */
export class ModerationBuilder implements IModerationBuilder {
  constructor(
    private provider: IModerationProvider,
    private providerType: Provider
  ) {}

  /**
   * Check content for policy violations
   */
  async check(content: string): Promise<ModerationResult> {
    const result = await this.provider.moderate(content);

    return {
      flagged: result.flagged,
      metadata: {
        model: 'moderation-latest',
        provider: this.providerType,
        categories: result.categories,
        categoryScores: result.categoryScores,
      },
    };
  }

  /**
   * Alias for check
   */
  async moderate(content: string): Promise<ModerationResult> {
    return this.check(content);
  }
}
