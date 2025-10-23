import type { IPlatformHTTP } from "@arc/contracts/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type {
  AnthropicMessage,
  AnthropicContentBlock,
  MessagesRequest,
} from "./types.js";
import {
  parseStreamEvent,
  extractEventContent,
  isStreamComplete,
  isErrorEvent,
} from "./streaming.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";

/**
 * Convert Arc messages to Anthropic format
 */
function convertMessages(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  attachments?: ImageAttachment[]
): { system?: string; messages: AnthropicMessage[] } {
  // Extract system message (if any)
  const systemMessage = messages.find(msg => msg.role === "system");
  const nonSystemMessages = messages.filter(msg => msg.role !== "system");

  // Convert messages to Anthropic format
  const anthropicMessages: AnthropicMessage[] = nonSystemMessages.map((msg, index) => {
    // Add attachments to the last user message
    if (
      msg.role === "user" &&
      index === nonSystemMessages.length - 1 &&
      attachments &&
      attachments.length > 0
    ) {
      const contentBlocks: AnthropicContentBlock[] = [
        { type: "text", text: msg.content },
        ...attachments.map((att): AnthropicContentBlock => {
          // Extract base64 data from data URL if present
          let base64Data = att.data;
          if (base64Data.startsWith("data:")) {
            const commaIndex = base64Data.indexOf(",");
            if (commaIndex !== -1) {
              base64Data = base64Data.slice(commaIndex + 1);
            }
          }

          return {
            type: "image",
            source: {
              type: "base64",
              media_type: att.mimeType,
              data: base64Data,
            },
          };
        }),
      ];

      return { role: msg.role as "user" | "assistant", content: contentBlocks };
    }

    return { role: msg.role as "user" | "assistant", content: msg.content };
  });

  const result: { system?: string; messages: AnthropicMessage[] } = {
    messages: anthropicMessages,
  };

  if (systemMessage) {
    result.system = systemMessage.content;
  }

  return result;
}

/**
 * Create chat completion capability
 */
export function createChatCapability(
  http: IPlatformHTTP,
  baseUrl: string,
  getHeaders: () => Record<string, string>,
  defaultMaxTokens: number
) {
  return {
    /**
     * Stream message completion
     */
    async *streamChatCompletion(
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
      model: string,
      attachments?: ImageAttachment[],
      signal?: AbortSignal
    ): AsyncGenerator<string, void, undefined> {
      // Convert messages to Anthropic format
      const { system, messages: anthropicMessages } = convertMessages(messages, attachments);

      const request: MessagesRequest = {
        model,
        max_tokens: defaultMaxTokens,
        messages: anthropicMessages,
        stream: true,
      };

      if (system) {
        request.system = system;
      }

      try {
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
          `${baseUrl}/messages`,
          requestOptions
        );

        for await (const line of stream) {
          const event = parseStreamEvent(line);

          if (!event) {
            continue; // Skip invalid events
          }

          // Check for errors
          if (isErrorEvent(event)) {
            const errorEvent = event as any;
            throw createProviderErrorFromResponse(
              500, // Anthropic doesn't provide status in error events
              JSON.stringify({ error: errorEvent.error })
            );
          }

          if (isStreamComplete(event)) {
            return; // Stream finished
          }

          const content = extractEventContent(event);
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
