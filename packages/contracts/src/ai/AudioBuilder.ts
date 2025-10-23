import type { AudioResult } from './Results.js';

/**
 * Audio transcription format
 */
export type AudioFormat = 'text' | 'json' | 'verbose_json' | 'srt' | 'vtt';

/**
 * Options for audio transcription
 */
export interface AudioTranscriptionOptions {
  /** Language of the audio (ISO 639-1) */
  language?: string;
  /** Response format */
  format?: AudioFormat;
  /** Temperature for sampling (0-1) */
  temperature?: number;
  /** Optional prompt to guide the model */
  prompt?: string;
}

/**
 * Fluent builder interface for audio transcription
 *
 * Usage:
 * ```typescript
 * const transcription = await ai.audio
 *   .model('whisper-1')
 *   .transcribe(audioFile);
 * ```
 */
export interface IAudioBuilder {
  /**
   * Set the model to use
   *
   * @param model - Audio model identifier (e.g., 'whisper-1')
   */
  model(model: string): IAudioBuilder;

  /**
   * Set transcription options
   *
   * @param options - Transcription options
   */
  options(options: AudioTranscriptionOptions): IAudioBuilder;

  /**
   * Transcribe audio to text
   *
   * @param audio - Audio file to transcribe
   * @returns Promise that resolves to the transcription
   */
  transcribe(audio: File | ArrayBuffer | Blob): Promise<AudioResult>;

  /**
   * Translate audio to English
   *
   * Automatically detects the source language and translates to English
   *
   * @param audio - Audio file to translate
   * @returns Promise that resolves to the English translation
   */
  translate(audio: File | ArrayBuffer | Blob): Promise<AudioResult>;
}
