/**
 * Gemini API Types
 *
 * Type definitions for Google's Gemini API
 * Based on https://ai.google.dev/api/generate-content
 */

/**
 * Message role in Gemini API
 */
export type GeminiRole = "user" | "model";

/**
 * Text part
 */
export interface GeminiTextPart {
  text: string;
}

/**
 * Inline data (for images, audio, etc.)
 */
export interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string; // base64
  };
}

/**
 * Content part union type
 */
export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

/**
 * Content (message) in Gemini format
 */
export interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

/**
 * Generation config
 */
export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

/**
 * Generate content request
 */
export interface GenerateContentRequest {
  contents: GeminiContent[];
  generationConfig?: GenerationConfig;
  systemInstruction?: {
    role: "user"; // System instructions use user role in Gemini
    parts: GeminiTextPart[];
  };
}

/**
 * Safety rating
 */
export interface SafetyRating {
  category: string;
  probability: string;
}

/**
 * Candidate finish reason
 */
export type FinishReason =
  | "FINISH_REASON_UNSPECIFIED"
  | "STOP"
  | "MAX_TOKENS"
  | "SAFETY"
  | "RECITATION"
  | "OTHER";

/**
 * Candidate (generation result)
 */
export interface Candidate {
  content: GeminiContent;
  finishReason?: FinishReason;
  safetyRatings?: SafetyRating[];
  citationMetadata?: unknown;
  tokenCount?: number;
}

/**
 * Usage metadata
 */
export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

/**
 * Streaming response chunk
 */
export interface GenerateContentStreamChunk {
  candidates?: Candidate[];
  promptFeedback?: {
    safetyRatings?: SafetyRating[];
  };
  usageMetadata?: UsageMetadata;
}

/**
 * Model information
 */
export interface GeminiModel {
  name: string;
  version: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
}

/**
 * List models response
 */
export interface ListModelsResponse {
  models: GeminiModel[];
}

/**
 * Error response from Gemini API
 */
export interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
    details?: unknown[];
  };
}
