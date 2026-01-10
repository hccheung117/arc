import { z } from 'zod'

export const arcProviderOptionsSchema = z.object({
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
})

export const arcErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
  }),
})

export const arcChatChunkSchema = z.object({
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
    }),
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
