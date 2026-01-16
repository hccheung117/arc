/**
 * AI Domain I/O Boundary
 *
 * Network response parsing for AI provider APIs.
 * Exports typed parsers and pre-configured handlers for AI SDK integration.
 */

import { z } from 'zod'
import {
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
} from '@ai-sdk/provider-utils'

// ============================================================================
// PRIVATE SCHEMAS
// ============================================================================

const ArcProviderOptionsSchema = z.object({
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
})

const ArcErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
  }),
})

const ArcChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z
        .object({
          role: z.enum(['assistant']).nullish(),
          content: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          reasoning: z.string().nullish(),
        })
        .nullish(),
      finish_reason: z.string().nullish(),
      index: z.number(),
    })
  ),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish(),
})

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type ArcProviderOptions = z.infer<typeof ArcProviderOptionsSchema>
export type ArcError = z.infer<typeof ArcErrorSchema>
export type ArcChatChunk = z.infer<typeof ArcChatChunkSchema>

// ============================================================================
// AI SDK HANDLERS (pre-configured with schemas)
// ============================================================================

/** Pre-configured SSE response handler for chat completions */
export const arcStreamHandler = createEventSourceResponseHandler(ArcChatChunkSchema)

/** Pre-configured error handler for Arc/OpenAI API errors */
export const arcErrorHandler = createJsonErrorResponseHandler({
  errorSchema: ArcErrorSchema,
  errorToMessage: (data) => data.error.message,
})

/** Schema for provider options parsing (needed by parseProviderOptions) */
export { ArcProviderOptionsSchema as arcProviderOptionsSchema }

// ============================================================================
// PARSERS
// ============================================================================

export const aiParser = {
  /** Parse AI provider options */
  parseOptions(data: unknown): ArcProviderOptions {
    return ArcProviderOptionsSchema.parse(data)
  },

  /** Safe parse AI provider options */
  safeParseOptions(data: unknown) {
    return ArcProviderOptionsSchema.safeParse(data)
  },

  /** Parse AI error response */
  parseError(data: unknown): ArcError {
    return ArcErrorSchema.parse(data)
  },

  /** Safe parse AI error response */
  safeParseError(data: unknown) {
    return ArcErrorSchema.safeParse(data)
  },

  /** Parse streaming chat chunk */
  parseChunk(data: unknown): ArcChatChunk {
    return ArcChatChunkSchema.parse(data)
  },

  /** Safe parse streaming chat chunk */
  safeParseChunk(data: unknown) {
    return ArcChatChunkSchema.safeParse(data)
  },
}
