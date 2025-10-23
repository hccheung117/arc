import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type {
  GeminiContent,
  GeminiPart,
  GeminiTextPart,
  GenerateContentRequest,
} from "./types.js";
import {
  parseStreamChunk,
  extractChunkContent,
  isStreamComplete,
} from "./streaming.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";

/**
 * Convert Arc messages to Gemini format
 */
function convertMessages(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  attachments?: ImageAttachment[]
): { systemInstruction?: { role: "user"; parts: GeminiTextPart[] }; contents: GeminiContent[] } {
  // Extract system message (if any)
  const systemMessage = messages.find(msg => msg.role === "system");
  const nonSystemMessages = messages.filter(msg => msg.role !== "system");

  // Convert messages to Gemini format
  const geminiContents: GeminiContent[] = nonSystemMessages.map((msg, index) => {
    // Map roles: assistant -> model
    const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";

    // Add attachments to the last user message
    if (
      msg.role === "user" &&
      index === nonSystemMessages.length - 1 &&
      attachments &&
      attachments.length > 0
    ) {
      const parts: GeminiPart[] = [
        { text: msg.content },
        ...attachments.map((att): GeminiPart => {
          // Extract base64 data from data URL if present
          let base64Data = att.data;
          if (base64Data.startsWith("data:")) {
            const commaIndex = base64Data.indexOf(",");
            if (commaIndex !== -1) {
              base64Data = base64Data.slice(commaIndex + 1);
            }
          }

          return {
            inlineData: {
              mimeType: att.mimeType,
              data: base64Data,
            },
          };
        }),
      ];

      return { role, parts };
    }

    // Regular text message
    return {
      role,
      parts: [{ text: msg.content }],
    };
  });

  const result: {
    systemInstruction?: { role: "user"; parts: GeminiTextPart[] };
    contents: GeminiContent[];
  } = {
    contents: geminiContents,
  };

  if (systemMessage) {
    result.systemInstruction = {
      role: "user",
      parts: [{ text: systemMessage.content }],
    };
  }

  return result;
}

/**
 * Create chat completion capability
 */
export function createChatCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  apiKey: string,
  getHeaders: () => Record<string, string>
) {
  return {
    /**
     * Stream chat completion
     */
    async *streamChatCompletion(
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
      model: string,
      attachments?: ImageAttachment[],
      signal?: AbortSignal
    ): AsyncGenerator<string, void, undefined> {
      // Convert messages to Gemini format
      const { systemInstruction, contents } = convertMessages(messages, attachments);

      const request: GenerateContentRequest = {
        contents,
      };

      if (systemInstruction) {
        request.systemInstruction = systemInstruction;
      }

      try {
        // Extract model name if it's a full resource path
        const modelName = model.startsWith("models/") ? model : `models/${model}`;

        // Build request options
        const requestOptions: {
          method: "POST";
          headers: Record<string, string>;
          body: string;
          signal?: AbortSignal;
        } = {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(request),
        };

        if (signal !== undefined) {
          requestOptions.signal = signal;
        }

        const stream = http.stream(
          `${baseUrl}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`,
          requestOptions
        );

        for await (const line of stream) {
          const chunk = parseStreamChunk(line);

          if (!chunk) {
            continue; // Skip invalid chunks
          }

          if (isStreamComplete(chunk)) {
            return; // Stream finished
          }

          const content = extractChunkContent(chunk);
          if (content) {
            yield content;
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          // Check if it's already a ProviderError
          if (error.constructor.name === "ProviderError") {
            throw error;
          }

          // Handle HTTP errors from the stream
          if (error.message.includes("HTTP ")) {
            const match = error.message.match(/HTTP (\d+):/);
            if (match) {
              const status = Number.parseInt(match[1] || "500", 10);
              const body = error.message.split("\n").slice(1).join("\n");
              throw createProviderErrorFromResponse(status, body);
            }
          }

          // Network errors
          throw createProviderErrorFromNetworkError(error);
        }

        throw error;
      }
    },
  };
}
