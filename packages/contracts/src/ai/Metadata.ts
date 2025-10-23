/**
 * Token usage information
 */
export interface Usage {
  /** Number of tokens in the prompt */
  promptTokens: number;
  /** Number of tokens in the completion */
  completionTokens: number;
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
}

/**
 * Reason why the model stopped generating
 */
export type FinishReason =
  | 'stop'        // Natural stop point
  | 'length'      // Max tokens reached
  | 'content_filter' // Content filtered
  | 'tool_calls'  // Tool/function call
  | 'cancel';     // Cancelled by user

/**
 * Supported AI provider types
 */
export type Provider = 'openai' | 'anthropic' | 'gemini';

/**
 * Base metadata included in all AI responses
 */
export interface BaseMetadata {
  /** The model that generated this response */
  model: string;
  /** The provider that served this request */
  provider: Provider;
}

/**
 * Metadata for chat completions
 */
export interface ChatMetadata extends BaseMetadata {
  /** Token usage information */
  usage: Usage;
  /** Why the model stopped generating */
  finishReason: FinishReason;
  /** Unique request/response ID from provider */
  id?: string;
  /** When the response was created (Unix timestamp) */
  created?: number;
}

/**
 * Metadata for embeddings
 */
export interface EmbeddingMetadata extends BaseMetadata {
  /** Token usage for the embedding request */
  usage: Usage;
  /** Dimension of the embedding vector */
  dimensions: number;
}

/**
 * Metadata for batch embeddings
 */
export interface EmbeddingBatchMetadata extends BaseMetadata {
  /** Total tokens used across all embeddings */
  usage: Usage;
  /** Dimension of the embedding vectors */
  dimensions: number;
  /** Number of embeddings in the batch */
  count: number;
}

/**
 * Metadata for streaming embeddings
 */
export interface EmbeddingStreamMetadata extends EmbeddingMetadata {
  /** Index of this embedding in the stream */
  index: number;
  /** Total number of embeddings in the stream */
  total: number;
}

/**
 * Metadata for image generation
 */
export interface ImageMetadata extends BaseMetadata {
  /** The revised/enhanced prompt used by the model (if available) */
  revisedPrompt?: string;
  /** When the image was created (Unix timestamp) */
  created?: number;
}

/**
 * Metadata for audio transcription
 */
export interface AudioMetadata extends BaseMetadata {
  /** Detected language (ISO 639-1 code) */
  language?: string;
  /** Duration of the audio in seconds */
  duration?: number;
  /** Timestamped segments (verbose mode only) */
  segments?: AudioSegment[];
}

/**
 * Audio segment with timestamp
 */
export interface AudioSegment {
  /** Segment ID */
  id: number;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Transcribed text for this segment */
  text: string;
  /** Confidence/probability score (0-1) */
  confidence?: number;
}

/**
 * Metadata for speech (TTS) generation
 */
export interface SpeechMetadata extends BaseMetadata {
  /** Audio format (mp3, opus, aac, flac, etc.) */
  format: string;
  /** Voice used for generation */
  voice: string;
  /** Speed/rate of speech */
  speed?: number;
}

/**
 * Metadata for moderation
 */
export interface ModerationMetadata extends BaseMetadata {
  /** Detailed category flags */
  categories: Record<string, boolean>;
  /** Category confidence scores (0-1) */
  categoryScores: Record<string, number>;
}
