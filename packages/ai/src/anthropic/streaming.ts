import type { AnthropicStreamEvent, ContentBlockDeltaEvent } from "./types.js";

/**
 * Parse a JSON line from Anthropic streaming response
 *
 * @param line - JSON string from SSE data field
 * @returns Parsed event or null if invalid
 */
export function parseStreamEvent(line: string): AnthropicStreamEvent | null {
  try {
    const event = JSON.parse(line) as AnthropicStreamEvent;
    return event;
  } catch (error) {
    // Invalid JSON, skip this line
    return null;
  }
}

/**
 * Extract text content from a streaming event
 *
 * @param event - Parsed event from Anthropic
 * @returns Text string or empty string
 */
export function extractEventContent(event: AnthropicStreamEvent): string {
  // Only content_block_delta events contain text
  if (event.type === "content_block_delta") {
    const deltaEvent = event as ContentBlockDeltaEvent;
    if (deltaEvent.delta.type === "text_delta") {
      return deltaEvent.delta.text;
    }
  }

  return "";
}

/**
 * Check if event signals end of stream
 *
 * @param event - Parsed event from Anthropic
 * @returns True if stream is finished
 */
export function isStreamComplete(event: AnthropicStreamEvent): boolean {
  return event.type === "message_stop";
}

/**
 * Check if event is an error
 *
 * @param event - Parsed event from Anthropic
 * @returns True if event is an error
 */
export function isErrorEvent(event: AnthropicStreamEvent): boolean {
  return event.type === "error";
}
