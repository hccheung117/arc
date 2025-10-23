import type {
  IAudioBuilder,
  AudioTranscriptionOptions,
} from '@arc/contracts/ai/audio/builder.js';
import type { AudioResult } from '@arc/contracts/ai/audio/results.js';
import type { Provider } from '@arc/contracts/ai/common/metadata.js';

/**
 * Provider interface for audio transcription
 * This will be implemented by provider adapters
 */
export interface IAudioProvider {
  transcribe(
    audio: File | ArrayBuffer | Blob,
    model: string,
    options?: AudioTranscriptionOptions
  ): Promise<{
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
      confidence?: number;
    }>;
  }>;

  translate(
    audio: File | ArrayBuffer | Blob,
    model: string
  ): Promise<{
    text: string;
  }>;
}

/**
 * Fluent audio builder implementation
 */
export class AudioBuilder implements IAudioBuilder {
  private selectedModel?: string;
  private transcriptionOptions?: AudioTranscriptionOptions;

  constructor(
    private provider: IAudioProvider,
    private providerType: Provider
  ) {}

  /**
   * Set the model to use
   */
  model(model: string): IAudioBuilder {
    this.selectedModel = model;
    return this;
  }

  /**
   * Set transcription options
   */
  options(options: AudioTranscriptionOptions): IAudioBuilder {
    this.transcriptionOptions = options;
    return this;
  }

  /**
   * Transcribe audio
   */
  async transcribe(audio: File | ArrayBuffer | Blob): Promise<AudioResult> {
    this.validateState();

    const result = await this.provider.transcribe(
      audio,
      this.selectedModel!,
      this.transcriptionOptions
    );

    return {
      text: result.text,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        language: result.language,
        duration: result.duration,
        segments: result.segments,
      },
    };
  }

  /**
   * Translate audio to English
   */
  async translate(audio: File | ArrayBuffer | Blob): Promise<AudioResult> {
    this.validateState();

    const result = await this.provider.translate(audio, this.selectedModel!);

    return {
      text: result.text,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        language: 'en',
      },
    };
  }

  /**
   * Validate builder state
   */
  private validateState(): void {
    if (!this.selectedModel) {
      throw new Error('Model must be set before transcribing audio');
    }
  }
}
