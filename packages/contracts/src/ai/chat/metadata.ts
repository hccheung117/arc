import type { BaseMetadata, Usage, FinishReason } from '../common/metadata.js';

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
