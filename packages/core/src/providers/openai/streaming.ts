import type { ChatCompletionChunk } from "./types.js";

/**
 * Parse a JSON line from OpenAI streaming response
 *
 * @param line - JSON string from SSE data field
 * @returns Parsed chunk or null if invalid
 */
export function parseStreamChunk(line: string): ChatCompletionChunk | null {
  try {
    const chunk = JSON.parse(line) as ChatCompletionChunk;
    return chunk;
  } catch (error) {
    // Invalid JSON, skip this line
    return null;
  }
}

/**
 * Extract content from a streaming chunk
 *
 * @param chunk - Parsed chunk from OpenAI
 * @returns Content string or empty string
 */
export function extractChunkContent(chunk: ChatCompletionChunk): string {
  if (!chunk.choices || chunk.choices.length === 0) {
    return "";
  }

  const choice = chunk.choices[0];
  if (!choice) {
    return "";
  }

  return choice.delta.content || "";
}

/**
 * Check if chunk signals end of stream
 *
 * @param chunk - Parsed chunk from OpenAI
 * @returns True if stream is finished
 */
export function isStreamComplete(chunk: ChatCompletionChunk): boolean {
  if (!chunk.choices || chunk.choices.length === 0) {
    return false;
  }

  const choice = chunk.choices[0];
  if (!choice) {
    return false;
  }

  return choice.finish_reason === "stop" || choice.finish_reason === "length";
}
