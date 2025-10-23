import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { Voice, SpeechOptions } from "@arc/contracts/ai/SpeechBuilder.js";
import type { SpeechGenerationRequest } from "./types.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";

/**
 * Convert string to ArrayBuffer (helper for audio responses)
 * Note: This is a placeholder - real implementation would handle binary data properly
 */
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

/**
 * Create speech synthesis capability
 */
export function createSpeechCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  getHeaders: () => Record<string, string>
) {
  return {
    /**
     * Generate speech from text
     */
    async speak(
      text: string,
      model: string,
      voice: Voice,
      options?: SpeechOptions
    ): Promise<{ audio: ArrayBuffer }> {
      try {
        const request: SpeechGenerationRequest = {
          model,
          input: text,
          voice,
          response_format: options?.format || 'mp3',
        };

        if (options?.speed !== undefined) {
          request.speed = options.speed;
        }

        const response = await http.request(`${baseUrl}/audio/speech`, {
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

        // Note: In a real implementation, the HTTP client would need to support binary responses
        // For now, we assume the response body can be converted to ArrayBuffer
        const audioBuffer = stringToArrayBuffer(response.body);

        return { audio: audioBuffer };
      } catch (error) {
        if (error instanceof Error && error.name === 'ProviderError') {
          throw error;
        }
        throw createProviderErrorFromNetworkError(error as Error);
      }
    },

    /**
     * Stream speech generation (not natively supported by OpenAI, so we return the full result)
     */
    async *streamSpeak(
      text: string,
      model: string,
      voice: Voice,
      options?: SpeechOptions
    ): AsyncIterable<ArrayBuffer> {
      // OpenAI doesn't support streaming TTS, so we yield the full result
      const result = await this.speak(text, model, voice, options);
      yield result.audio;
    },
  };
}
