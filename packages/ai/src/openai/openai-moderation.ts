import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ModerationRequest, ModerationResponse } from "./types.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";

/**
 * Create moderation capability
 */
export function createModerationCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  getHeaders: () => Record<string, string>
) {
  return {
    /**
     * Check content for policy violations
     */
    async moderate(content: string): Promise<{
      flagged: boolean;
      categories: Record<string, boolean>;
      categoryScores: Record<string, number>;
    }> {
      try {
        const request: ModerationRequest = {
          input: content,
        };

        const response = await http.request(`${baseUrl}/moderations`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw createProviderErrorFromResponse(
            response.status,
            response.body,
            response.headers
          );
        }

        const data = JSON.parse(response.body) as ModerationResponse;
        const result = data.results[0];

        if (!result) {
          throw new Error('No moderation result returned from API');
        }

        return {
          flagged: result.flagged,
          categories: result.categories as unknown as Record<string, boolean>,
          categoryScores: result.category_scores as unknown as Record<string, number>,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'ProviderError') {
          throw error;
        }
        throw createProviderErrorFromNetworkError(error as Error);
      }
    },
  };
}
