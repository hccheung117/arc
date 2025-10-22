import type { ChatCompletionChunk, LegacyCompletionChunk, StreamChunk } from "./types.js";

/**
 * Parse a JSON line from OpenAI streaming response
 * Handles both modern chat completions and legacy text completions
 *
 * @param line - JSON string from SSE data field
 * @returns Parsed chunk or null if invalid
 */
export function parseStreamChunk(line: string): StreamChunk | null {
  try {
    const chunk = JSON.parse(line) as StreamChunk;
    return chunk;
  } catch (error) {
    // Invalid JSON, skip this line
    return null;
  }
}

/**
 * Check if chunk is a chat completion chunk
 */
function isChatCompletionChunk(chunk: StreamChunk): chunk is ChatCompletionChunk {
  return chunk.object === "chat.completion.chunk";
}

/**
 * Check if chunk is a legacy completion chunk
 */
function isLegacyCompletionChunk(chunk: StreamChunk): chunk is LegacyCompletionChunk {
  return chunk.object === "text_completion";
}

/**
 * Extract content from a streaming chunk
 * Handles both modern chat completions and legacy text completions
 *
 * @param chunk - Parsed chunk from OpenAI
 * @returns Content string or empty string
 */
export function extractChunkContent(chunk: StreamChunk): string {
  if (!chunk.choices || chunk.choices.length === 0) {
    return "";
  }

  // Handle chat completion chunks (modern)
  if (isChatCompletionChunk(chunk)) {
    const choice = chunk.choices[0];
    if (!choice) {
      return "";
    }
    return choice.delta.content || "";
  }

  // Handle legacy completion chunks
  if (isLegacyCompletionChunk(chunk)) {
    const choice = chunk.choices[0];
    if (!choice) {
      return "";
    }
    return choice.text || "";
  }

  return "";
}

/**
 * Check if chunk signals end of stream
 * Handles both modern chat completions and legacy text completions
 *
 * @param chunk - Parsed chunk from OpenAI
 * @returns True if stream is finished
 */
export function isStreamComplete(chunk: StreamChunk): boolean {
  if (!chunk.choices || chunk.choices.length === 0) {
    return false;
  }

  const choice = chunk.choices[0];
  if (!choice) {
    return false;
  }

  return choice.finish_reason === "stop" || choice.finish_reason === "length";
}
