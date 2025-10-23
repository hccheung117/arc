import type {
  IImageBuilder,
  ImageGenerationOptions,
  ImageEditOptions,
  ImageVariationsOptions,
  ImageResponseFormat,
} from '@arc/contracts/ai/ImageBuilder.js';
import type { ImageResult, ImageVariationsResult } from '@arc/contracts/ai/Results.js';
import type { Provider } from '@arc/contracts/ai/Metadata.js';

/**
 * Provider interface for image generation
 * This will be implemented by provider adapters
 */
export interface IImageProvider {
  generate(prompt: string, model: string, options?: ImageGenerationOptions & { responseFormat?: ImageResponseFormat }): Promise<{
    url?: string;
    b64?: string;
    revisedPrompt?: string;
  }>;

  edit(options: ImageEditOptions, model: string): Promise<{
    url?: string;
    b64?: string;
  }>;

  variations(image: File | ArrayBuffer | string, model: string, options?: ImageVariationsOptions): Promise<{
    urls: string[];
  }>;
}

/**
 * Fluent image builder implementation
 */
export class ImageBuilder implements IImageBuilder {
  private selectedModel?: string;
  private generationOptions?: ImageGenerationOptions;
  private responseFormatValue?: ImageResponseFormat;

  constructor(
    private provider: IImageProvider,
    private providerType: Provider
  ) {}

  /**
   * Set the model to use
   */
  model(model: string): IImageBuilder {
    this.selectedModel = model;
    return this;
  }

  /**
   * Set generation options
   */
  options(options: ImageGenerationOptions): IImageBuilder {
    this.generationOptions = options;
    return this;
  }

  /**
   * Set response format
   */
  responseFormat(format: ImageResponseFormat): IImageBuilder {
    this.responseFormatValue = format;
    return this;
  }

  /**
   * Generate an image
   */
  async generate(prompt: string): Promise<ImageResult> {
    this.validateState();

    const result = await this.provider.generate(
      prompt,
      this.selectedModel!,
      {
        ...this.generationOptions,
        responseFormat: this.responseFormatValue,
      }
    );

    return {
      url: result.url,
      b64: result.b64,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        revisedPrompt: result.revisedPrompt,
        created: Date.now(),
      },
    };
  }

  /**
   * Edit an image
   */
  async edit(options: ImageEditOptions): Promise<ImageResult> {
    this.validateState();

    const result = await this.provider.edit(options, this.selectedModel!);

    return {
      url: result.url,
      b64: result.b64,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        created: Date.now(),
      },
    };
  }

  /**
   * Create variations of an image
   */
  async variations(
    image: File | ArrayBuffer | string,
    options?: ImageVariationsOptions
  ): Promise<ImageVariationsResult> {
    this.validateState();

    const result = await this.provider.variations(image, this.selectedModel!, options);

    return {
      urls: result.urls,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        created: Date.now(),
      },
    };
  }

  /**
   * Validate builder state
   */
  private validateState(): void {
    if (!this.selectedModel) {
      throw new Error('Model must be set before generating images');
    }
  }
}
