import type {
  ISpeechBuilder,
  Voice,
  SpeechOptions,
} from '@arc/contracts/ai/SpeechBuilder.js';
import type { SpeechResult, SpeechChunk } from '@arc/contracts/ai/Results.js';
import type { CancellableStream as ICancellableStream } from '@arc/contracts/ai/Streams.js';
import type { Provider } from '@arc/contracts/ai/Metadata.js';
import { createCancellableStream } from '../utils/CancellableStream.js';

/**
 * Provider interface for speech synthesis
 * This will be implemented by provider adapters
 */
export interface ISpeechProvider {
  speak(
    text: string,
    model: string,
    voice: Voice,
    options?: SpeechOptions
  ): Promise<{
    audio: ArrayBuffer;
  }>;

  streamSpeak(
    text: string,
    model: string,
    voice: Voice,
    options?: SpeechOptions
  ): AsyncIterable<ArrayBuffer>;
}

/**
 * Fluent speech builder implementation
 */
export class SpeechBuilder implements ISpeechBuilder {
  private selectedModel?: string;
  private selectedVoice?: Voice;
  private speechOptions?: SpeechOptions;

  constructor(
    private provider: ISpeechProvider,
    private providerType: Provider
  ) {}

  /**
   * Set the model to use
   */
  model(model: string): ISpeechBuilder {
    this.selectedModel = model;
    return this;
  }

  /**
   * Set the voice to use
   */
  voice(voice: Voice): ISpeechBuilder {
    this.selectedVoice = voice;
    return this;
  }

  /**
   * Set speech options
   */
  options(options: SpeechOptions): ISpeechBuilder {
    this.speechOptions = options;
    return this;
  }

  /**
   * Generate speech
   */
  async speak(text: string): Promise<SpeechResult> {
    this.validateState();

    const result = await this.provider.speak(
      text,
      this.selectedModel!,
      this.selectedVoice!,
      this.speechOptions
    );

    return {
      audio: result.audio,
      metadata: {
        model: this.selectedModel!,
        provider: this.providerType,
        format: this.speechOptions?.format || 'mp3',
        voice: this.selectedVoice!,
        speed: this.speechOptions?.speed,
      },
    };
  }

  /**
   * Stream speech generation
   */
  streamSpeak(text: string): ICancellableStream<SpeechChunk> {
    this.validateState();

    const model = this.selectedModel!;
    const voice = this.selectedVoice!;
    const options = this.speechOptions;
    const provider = this.provider;
    const providerType = this.providerType;

    return createCancellableStream(async function* (signal) {
      const stream = provider.streamSpeak(text, model, voice, options);

      for await (const audioChunk of stream) {
        if (signal.aborted) {
          return;
        }

        yield {
          audio: audioChunk,
          metadata: {
            model,
            provider: providerType,
            format: options?.format || 'mp3',
            voice,
            speed: options?.speed,
          },
        };
      }
    });
  }

  /**
   * Validate builder state
   */
  private validateState(): void {
    if (!this.selectedModel) {
      throw new Error('Model must be set before generating speech');
    }
    if (!this.selectedVoice) {
      throw new Error('Voice must be set before generating speech');
    }
  }
}
