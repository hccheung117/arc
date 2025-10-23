import type { ImageResult, ImageVariationsResult } from './results.js';

/**
 * Image size options
 */
export type ImageSize =
  | '256x256'
  | '512x512'
  | '1024x1024'
  | '1792x1024'
  | '1024x1792';

/**
 * Image quality options
 */
export type ImageQuality = 'standard' | 'hd';

/**
 * Image style options
 */
export type ImageStyle = 'vivid' | 'natural';

/**
 * Response format for images
 */
export type ImageResponseFormat = 'url' | 'b64_json';

/**
 * Options for image generation
 */
export interface ImageGenerationOptions {
  /** Image size */
  size?: ImageSize;
  /** Image quality (DALL-E 3 only) */
  quality?: ImageQuality;
  /** Image style (DALL-E 3 only) */
  style?: ImageStyle;
  /** Number of images to generate (DALL-E 2 only) */
  n?: number;
  /** User identifier for abuse monitoring */
  user?: string;
}

/**
 * Options for image editing
 */
export interface ImageEditOptions {
  /** Original image to edit */
  image: File | ArrayBuffer | string;
  /** Mask indicating areas to edit (transparent areas will be edited) */
  mask?: File | ArrayBuffer | string;
  /** Description of the edit to make */
  prompt: string;
  /** Number of variations */
  n?: number;
  /** Image size */
  size?: ImageSize;
  /** User identifier */
  user?: string;
}

/**
 * Options for image variations
 */
export interface ImageVariationsOptions {
  /** Number of variations */
  n?: number;
  /** Image size */
  size?: ImageSize;
  /** User identifier */
  user?: string;
}

/**
 * Fluent builder interface for image generation
 *
 * Usage:
 * ```typescript
 * const image = await ai.image
 *   .model('dall-e-3')
 *   .generate('A serene mountain landscape');
 * ```
 */
export interface IImageBuilder {
  /**
   * Set the model to use
   *
   * @param model - Image model identifier (e.g., 'dall-e-3', 'dall-e-2')
   */
  model(model: string): IImageBuilder;

  /**
   * Set generation options
   *
   * @param options - Image generation options
   */
  options(options: ImageGenerationOptions): IImageBuilder;

  /**
   * Set the response format
   *
   * @param format - 'url' for HTTP URL, 'b64_json' for base64 data
   */
  responseFormat(format: ImageResponseFormat): IImageBuilder;

  /**
   * Generate an image from a text prompt
   *
   * @param prompt - Description of the image to generate
   * @returns Promise that resolves to the image result
   */
  generate(prompt: string): Promise<ImageResult>;

  /**
   * Edit an image (DALL-E 2 only)
   *
   * @param options - Edit options including image, mask, and prompt
   * @returns Promise that resolves to the edited image
   */
  edit(options: ImageEditOptions): Promise<ImageResult>;

  /**
   * Create variations of an image (DALL-E 2 only)
   *
   * @param image - Source image to create variations from
   * @param options - Variation options
   * @returns Promise that resolves to the variations
   */
  variations(
    image: File | ArrayBuffer | string,
    options?: ImageVariationsOptions
  ): Promise<ImageVariationsResult>;
}
