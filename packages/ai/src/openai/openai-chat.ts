import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type {
  OpenAIMessage,
  OpenAIMessageContent,
  ChatCompletionRequest,
  LegacyCompletionRequest,
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
import { ProviderErrorCode } from "@arc/core/domain/ProviderError.js";

/**
 * Convert messages array to a prompt string for legacy completions
 */
function messagesToPrompt(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
): string {
  return messages
    .map((msg) => {
      const roleLabel = msg.role === "system" ? "System" :
                       msg.role === "user" ? "User" : "Assistant";
      return `${roleLabel}: ${msg.content}`;
    })
    .join("\n\n") + "\n\nAssistant:";
}

/**
 * Stream using legacy /v1/completions endpoint
 */
async function* streamLegacyCompletion(
  http: IPlatformHTTP,
  baseUrl: string,
  headers: Record<string, string>,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<string, void, undefined> {
  const prompt = messagesToPrompt(messages);

  const request: LegacyCompletionRequest = {
    model,
    prompt,
    stream: true,
    temperature: 0.7,
  };

  const requestOptions: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  } = {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  };

  if (signal !== undefined) {
    requestOptions.signal = signal;
  }

  const stream = http.stream(
    `${baseUrl}/completions`,
    requestOptions
  );

  for await (const line of stream) {
    const chunk = parseStreamChunk(line);

    if (!chunk) {
      continue;
    }

    if (isStreamComplete(chunk)) {
      return;
    }

    const content = extractChunkContent(chunk);
    if (content) {
      yield content;
    }
  }
}

/**
 * Create chat completion capability
 */
export function createChatCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  getHeaders: () => Record<string, string>
) {
  return {
    /**
     * Stream chat completion with auto-fallback to legacy completions
     *
     * Converts Arc's message format to OpenAI format and streams the response
     * Automatically falls back to legacy /v1/completions if chat completions fail
     *
     * @param messages - Array of messages (user/assistant/system)
     * @param model - Model to use (e.g., "gpt-4", "gpt-3.5-turbo")
     * @param attachments - Optional image attachments for the latest message
     * @param signal - AbortSignal for cancellation
     * @returns AsyncGenerator yielding content chunks
     */
    async *streamChatCompletion(
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
      model: string,
      attachments?: ImageAttachment[],
      signal?: AbortSignal
    ): AsyncGenerator<string, void, undefined> {
      // Convert messages to OpenAI format
      const openAIMessages: OpenAIMessage[] = messages.map((msg, index) => {
        // Add attachments to the last user message
        if (
          msg.role === "user" &&
          index === messages.length - 1 &&
          attachments &&
          attachments.length > 0
        ) {
          const content: OpenAIMessageContent[] = [
            { type: "text", text: msg.content },
            ...attachments.map((att) => ({
              type: "image_url" as const,
              image_url: {
                url: att.data, // data URL
                detail: "auto" as const,
              },
            })),
          ];
          return { role: msg.role, content };
        }

        return { role: msg.role, content: msg.content };
      });

      const request: ChatCompletionRequest = {
        model,
        messages: openAIMessages,
        stream: true,
        temperature: 0.7,
      };

      try {
        // Build request options, conditionally including signal
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
          `${baseUrl}/chat/completions`,
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
            const providerError = error as any; // Type assertion for error code access

            // Auto-fallback to legacy completions for 404 or model not found
            // Also fallback if the error mentions chat completions not being supported
            if (
              providerError.code === ProviderErrorCode.MODEL_NOT_FOUND ||
              error.message.includes("does not support chat completions") ||
              error.message.includes("404")
            ) {
              // Fallback to legacy completions (no vision support in legacy)
              if (attachments && attachments.length > 0) {
                throw new Error("Legacy completions API does not support image attachments");
              }

              yield* streamLegacyCompletion(http, baseUrl, getHeaders(), messages, model, signal);
              return;
            }

            throw error;
          }

          // Handle HTTP errors from the stream
          if (error.message.includes("HTTP ")) {
            const match = error.message.match(/HTTP (\d+):/);
            if (match) {
              const status = Number.parseInt(match[1] || "500", 10);
              const body = error.message.split("\n").slice(1).join("\n");

              // Try fallback on 404
              if (status === 404) {
                if (attachments && attachments.length > 0) {
                  throw new Error("Legacy completions API does not support image attachments");
                }
                yield* streamLegacyCompletion(http, baseUrl, getHeaders(), messages, model, signal);
                return;
              }

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
