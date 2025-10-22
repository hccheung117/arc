import type { GenerateContentStreamChunk, GeminiTextPart } from "./types.js";

/**
 * Parse a JSON line from Gemini streaming response
 *
 * @param line - JSON string from streaming response
 * @returns Parsed chunk or null if invalid
 */
export function parseStreamChunk(line: string): GenerateContentStreamChunk | null {
  try {
    const chunk = JSON.parse(line) as GenerateContentStreamChunk;
    return chunk;
  } catch (error) {
    // Invalid JSON, skip this line
    return null;
  }
}

/**
 * Extract text content from a streaming chunk
 *
 * @param chunk - Parsed chunk from Gemini
 * @returns Text string or empty string
 */
export function extractChunkContent(chunk: GenerateContentStreamChunk): string {
  if (!chunk.candidates || chunk.candidates.length === 0) {
    return "";
  }

  const candidate = chunk.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    return "";
  }

  // Extract text from all text parts
  const textParts = candidate.content.parts
    .filter((part): part is GeminiTextPart => 'text' in part)
    .map(part => part.text);

  return textParts.join('');
}

/**
 * Check if chunk signals end of stream
 *
 * @param chunk - Parsed chunk from Gemini
 * @returns True if stream is finished
 */
export function isStreamComplete(chunk: GenerateContentStreamChunk): boolean {
  if (!chunk.candidates || chunk.candidates.length === 0) {
    return false;
  }

  const candidate = chunk.candidates[0];
  if (!candidate || !candidate.finishReason) {
    return false;
  }

  // Stream is complete if there's a finish reason and it's not unspecified
  return (
    candidate.finishReason === "STOP" ||
    candidate.finishReason === "MAX_TOKENS" ||
    candidate.finishReason === "SAFETY" ||
    candidate.finishReason === "RECITATION" ||
    candidate.finishReason === "OTHER"
  );
}
