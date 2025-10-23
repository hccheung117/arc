import type { SpeechResult, SpeechChunk } from './Results.js';
import type { CancellableStream } from './Streams.js';

/**
 * Available voices for speech synthesis
 */
export type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/**
 * Audio format for speech output
 */
export type SpeechFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

/**
 * Options for speech synthesis
 */
export interface SpeechOptions {
  /** Speech speed (0.25 to 4.0) */
  speed?: number;
  /** Audio format */
  format?: SpeechFormat;
}

/**
 * Fluent builder interface for speech (text-to-speech)
 *
 * Usage:
 * ```typescript
 * const speech = await ai.speech
 *   .model('tts-1')
 *   .voice('alloy')
 *   .speak('Hello world');
 * ```
 */
export interface ISpeechBuilder {
  /**
   * Set the model to use
   *
   * @param model - Speech model identifier (e.g., 'tts-1', 'tts-1-hd')
   */
  model(model: string): ISpeechBuilder;

  /**
   * Set the voice to use
   *
   * @param voice - Voice identifier
   */
  voice(voice: Voice): ISpeechBuilder;

  /**
   * Set speech options
   *
   * @param options - Speech synthesis options
   */
  options(options: SpeechOptions): ISpeechBuilder;

  /**
   * Generate speech from text
   *
   * @param text - Text to convert to speech
   * @returns Promise that resolves to the audio result
   */
  speak(text: string): Promise<SpeechResult>;

  /**
   * Stream speech generation for long text
   *
   * Useful for real-time playback of long content
   *
   * @param text - Text to convert to speech
   * @returns A cancellable async iterable of audio chunks
   */
  streamSpeak(text: string): CancellableStream<SpeechChunk>;
}
