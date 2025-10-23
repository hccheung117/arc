import type { IPlatformHTTP } from "@arc/contracts/platform/IPlatformHTTP.js";
import type { ImageGenerationRequest, ImageGenerationResponse } from "./types.js";
import type { ImageGenerationOptions, ImageEditOptions, ImageVariationsOptions, ImageResponseFormat } from "@arc/contracts/ai/image/builder.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";

/**
 * Create image generation capability
 */
export function createImageCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  getHeaders: () => Record<string, string>
) {
  return {
    /**
     * Generate an image from a text prompt
     */
    async generate(
      prompt: string,
      model: string,
      options?: ImageGenerationOptions & { responseFormat?: ImageResponseFormat }
    ): Promise<{ url?: string; b64?: string; revisedPrompt?: string }> {
      try {
        const request: ImageGenerationRequest = {
          prompt,
          model,
          n: options?.n || 1,
          response_format: options?.responseFormat || 'url',
        };

        if (options?.size) request.size = options.size;
        if (options?.quality) request.quality = options.quality;
        if (options?.style) request.style = options.style;
        if (options?.user) request.user = options.user;

        const response = await http.request(`${baseUrl}/images/generations`, {
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

        const data = JSON.parse(response.body) as ImageGenerationResponse;
        const image = data.data[0];

        if (!image) {
          throw new Error('No image returned from API');
        }

        return {
          url: image.url,
          b64: image.b64_json,
          revisedPrompt: image.revised_prompt,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'ProviderError') {
          throw error;
        }
        throw createProviderErrorFromNetworkError(error as Error);
      }
    },

    /**
     * Edit an image (DALL-E 2 only)
     */
    async edit(
      options: ImageEditOptions,
      model: string
    ): Promise<{ url?: string; b64?: string }> {
      // Note: Image editing requires multipart/form-data which is complex in a platform-agnostic way
      // This is a simplified implementation that would need platform-specific handling
      throw new Error('Image editing not yet fully implemented - requires platform-specific FormData handling');
    },

    /**
     * Create variations of an image (DALL-E 2 only)
     */
    async variations(
      image: File | ArrayBuffer | string,
      model: string,
      options?: ImageVariationsOptions
    ): Promise<{ urls: string[] }> {
      // Note: Image variations require multipart/form-data
      throw new Error('Image variations not yet fully implemented - requires platform-specific FormData handling');
    },
  };
}
