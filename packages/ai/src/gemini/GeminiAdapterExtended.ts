import { GeminiAdapter as BaseGeminiAdapter } from "./GeminiAdapter.js";
import type { IEmbeddingProvider } from "../builders/EmbeddingBuilder.js";
import type { IImageProvider } from "../builders/ImageBuilder.js";
import type { IAudioProvider } from "../builders/AudioBuilder.js";
import type { ISpeechProvider } from "../builders/SpeechBuilder.js";
import type { IModerationProvider } from "../builders/ModerationBuilder.js";
import type { Voice, SpeechOptions } from "@arc/contracts/ai/SpeechBuilder.js";
import type { AudioTranscriptionOptions } from "@arc/contracts/ai/AudioBuilder.js";
import type { ImageGenerationOptions, ImageEditOptions, ImageVariationsOptions, ImageResponseFormat } from "@arc/contracts/ai/ImageBuilder.js";

/**
 * Extended Gemini API adapter
 *
 * Gemini supports chat and embeddings, but not images, audio, speech, or moderation
 */
export class GeminiAdapterExtended extends BaseGeminiAdapter implements
  IEmbeddingProvider,
  IImageProvider,
  IAudioProvider,
  ISpeechProvider,
  IModerationProvider {

  // ==================== Embedding APIs ====================
  // Note: Gemini has embeddings API but it's not implemented yet in the base adapter
  // These are stubs for now

  async embed(): Promise<{ vector: number[]; usage: { promptTokens: number; totalTokens: number } }> {
    throw new Error('Gemini embeddings not yet implemented. Use OpenAI or implement Gemini embeddings API.');
  }

  async embedBatch(): Promise<{ vectors: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
    throw new Error('Gemini batch embeddings not yet implemented. Use OpenAI or implement Gemini embeddings API.');
  }

  // ==================== Image Generation APIs (NOT SUPPORTED) ====================

  async generate(): Promise<{ url?: string; b64?: string; revisedPrompt?: string }> {
    throw new Error('Gemini does not support image generation. Use OpenAI DALL-E or another provider for image generation.');
  }

  async edit(): Promise<{ url?: string; b64?: string }> {
    throw new Error('Gemini does not support image editing. Use OpenAI DALL-E or another provider for image editing.');
  }

  async variations(): Promise<{ urls: string[] }> {
    throw new Error('Gemini does not support image variations. Use OpenAI DALL-E or another provider for image variations.');
  }

  // ==================== Audio Transcription APIs (NOT SUPPORTED) ====================

  async transcribe(): Promise<{
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
  }> {
    throw new Error('Gemini does not support audio transcription. Use OpenAI Whisper or another provider for audio transcription.');
  }

  async translate(): Promise<{ text: string }> {
    throw new Error('Gemini does not support audio translation. Use OpenAI Whisper or another provider for audio translation.');
  }

  // ==================== Speech (TTS) APIs (NOT SUPPORTED) ====================

  async speak(): Promise<{ audio: ArrayBuffer }> {
    throw new Error('Gemini does not support text-to-speech. Use OpenAI TTS or another provider for speech synthesis.');
  }

  async *streamSpeak(): AsyncIterable<ArrayBuffer> {
    throw new Error('Gemini does not support text-to-speech. Use OpenAI TTS or another provider for speech synthesis.');
  }

  // ==================== Moderation APIs (NOT SUPPORTED) ====================

  async moderate(): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }> {
    throw new Error('Gemini does not have a dedicated moderation API. Use OpenAI Moderation or implement custom moderation.');
  }
}
