/**
 * Anthropic API Types
 *
 * Type definitions for Anthropic's Messages API
 * Based on https://docs.anthropic.com/en/api/messages
 */

/**
 * Message role in Anthropic API
 * Note: system messages are handled separately via the `system` parameter
 */
export type AnthropicRole = "user" | "assistant";

/**
 * Text content block
 */
export interface AnthropicTextContent {
  type: "text";
  text: string;
}

/**
 * Image content block
 */
export interface AnthropicImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string; // e.g., "image/jpeg", "image/png"
    data: string; // base64 data without data URL prefix
  };
}

/**
 * Content block union type
 */
export type AnthropicContentBlock = AnthropicTextContent | AnthropicImageContent;

/**
 * Message in Anthropic format
 */
export interface AnthropicMessage {
  role: AnthropicRole;
  content: string | AnthropicContentBlock[];
}

/**
 * Messages API request
 */
export interface MessagesRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string; // System message (separate from messages array)
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  stop_sequences?: string[];
}

/**
 * Streaming event types
 */
export type AnthropicStreamEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_stop"
  | "ping"
  | "error";

/**
 * Base streaming event
 */
export interface BaseStreamEvent {
  type: AnthropicStreamEventType;
}

/**
 * Message start event
 */
export interface MessageStartEvent extends BaseStreamEvent {
  type: "message_start";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    content: [];
    model: string;
    stop_reason: null;
    stop_sequence: null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

/**
 * Content block start event
 */
export interface ContentBlockStartEvent extends BaseStreamEvent {
  type: "content_block_start";
  index: number;
  content_block: {
    type: "text";
    text: string;
  };
}

/**
 * Text delta
 */
export interface TextDelta {
  type: "text_delta";
  text: string;
}

/**
 * Content block delta event
 */
export interface ContentBlockDeltaEvent extends BaseStreamEvent {
  type: "content_block_delta";
  index: number;
  delta: TextDelta;
}

/**
 * Content block stop event
 */
export interface ContentBlockStopEvent extends BaseStreamEvent {
  type: "content_block_stop";
  index: number;
}

/**
 * Message delta event
 */
export interface MessageDeltaEvent extends BaseStreamEvent {
  type: "message_delta";
  delta: {
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | null;
    stop_sequence?: string | null;
  };
  usage: {
    output_tokens: number;
  };
}

/**
 * Message stop event
 */
export interface MessageStopEvent extends BaseStreamEvent {
  type: "message_stop";
}

/**
 * Ping event
 */
export interface PingEvent extends BaseStreamEvent {
  type: "ping";
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseStreamEvent {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}

/**
 * Union type for all stream events
 */
export type AnthropicStreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

/**
 * Model information
 */
export interface AnthropicModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

/**
 * List models response
 * Note: Anthropic doesn't have a models endpoint, so we return static list
 */
export interface ListModelsResponse {
  object: "list";
  data: AnthropicModel[];
}

/**
 * Error response from Anthropic API
 */
export interface AnthropicErrorResponse {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}
