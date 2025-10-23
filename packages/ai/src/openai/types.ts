/**
 * OpenAI API Types
 *
 * Minimal type definitions for OpenAI API
 * Based on https://platform.openai.com/docs/api-reference
 */

/**
 * Message role in a conversation
 */
export type OpenAIRole = "user" | "assistant" | "system";

/**
 * Message content (text or multimodal)
 */
export interface OpenAIMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string; // data URL or https URL
    detail?: "auto" | "low" | "high";
  };
}

/**
 * Chat message
 */
export interface OpenAIMessage {
  role: OpenAIRole;
  content: string | OpenAIMessageContent[];
  name?: string;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
}

/**
 * Choice in a chat completion response
 */
export interface ChatCompletionChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: "stop" | "length" | "content_filter" | "tool_calls" | null;
}

/**
 * Chat completion response (non-streaming)
 */
export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Delta in a streaming chunk
 */
export interface ChatCompletionDelta {
  role?: OpenAIRole;
  content?: string;
}

/**
 * Choice in a streaming chunk
 */
export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionDelta;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

/**
 * Streaming chunk from chat completion
 */
export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

/**
 * Model information
 */
export interface OpenAIModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

/**
 * List models response
 */
export interface ListModelsResponse {
  object: "list";
  data: OpenAIModel[];
}

/**
 * Error response from OpenAI API
 */
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * Legacy completion request (for /v1/completions endpoint)
 */
export interface LegacyCompletionRequest {
  model: string;
  prompt: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
}

/**
 * Legacy completion streaming chunk
 */
export interface LegacyCompletionChunk {
  id: string;
  object: "text_completion";
  created: number;
  model: string;
  choices: Array<{
    text: string;
    index: number;
    logprobs?: unknown;
    finish_reason: "stop" | "length" | null;
  }>;
}

/**
 * Union type for all streaming chunk types
 */
export type StreamChunk = ChatCompletionChunk | LegacyCompletionChunk;

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

/**
 * Embedding object
 */
export interface EmbeddingObject {
  object: 'embedding';
  embedding: number[];
  index: number;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  object: 'list';
  data: EmbeddingObject[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Image generation request
 */
export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  n?: number;
  quality?: 'standard' | 'hd';
  response_format?: 'url' | 'b64_json';
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  style?: 'vivid' | 'natural';
  user?: string;
}

/**
 * Image object
 */
export interface ImageObject {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  created: number;
  data: ImageObject[];
}

/**
 * Audio transcription request (multipart form data)
 */
export interface AudioTranscriptionRequest {
  file: File | Blob | ArrayBuffer;
  model: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

/**
 * Audio transcription response (text format)
 */
export type AudioTranscriptionTextResponse = string;

/**
 * Audio segment (verbose format)
 */
export interface AudioSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

/**
 * Audio transcription response (verbose JSON format)
 */
export interface AudioTranscriptionVerboseResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments?: AudioSegment[];
}

/**
 * Audio transcription response (JSON format)
 */
export interface AudioTranscriptionJsonResponse {
  text: string;
}

/**
 * Speech generation request
 */
export interface SpeechGenerationRequest {
  model: string;
  input: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
}

/**
 * Moderation request
 */
export interface ModerationRequest {
  input: string | string[];
  model?: string;
}

/**
 * Moderation categories
 */
export interface ModerationCategories {
  hate: boolean;
  'hate/threatening': boolean;
  harassment: boolean;
  'harassment/threatening': boolean;
  'self-harm': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  sexual: boolean;
  'sexual/minors': boolean;
  violence: boolean;
  'violence/graphic': boolean;
}

/**
 * Moderation category scores
 */
export interface ModerationCategoryScores {
  hate: number;
  'hate/threatening': number;
  harassment: number;
  'harassment/threatening': number;
  'self-harm': number;
  'self-harm/intent': number;
  'self-harm/instructions': number;
  sexual: number;
  'sexual/minors': number;
  violence: number;
  'violence/graphic': number;
}

/**
 * Moderation result
 */
export interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategories;
  category_scores: ModerationCategoryScores;
}

/**
 * Moderation response
 */
export interface ModerationResponse {
  id: string;
  model: string;
  results: ModerationResult[];
}
