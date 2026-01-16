/**
 * Format conversion between AI SDK and Arc/OpenAI API
 * Delta: file→image_url, multi-part assistant→string, tool messages dropped
 */

import {
  LanguageModelV3FinishReason,
  LanguageModelV3Prompt,
  LanguageModelV3Usage,
} from '@ai-sdk/provider'
import type { ArcChatChunk } from '@boundary/ai'

// ============================================================================
// REQUEST: AI SDK → Arc/OpenAI format
// ============================================================================

type UserPart = Extract<LanguageModelV3Prompt[number], { role: 'user' }>
type FilePart = Extract<UserPart['content'][number], { type: 'file' }>

const toDataUrl = (part: FilePart) => {
  const { data, mediaType } = part
  if (typeof data === 'string') return data.startsWith('data:') ? data : `data:${mediaType};base64,${data}`
  if (data instanceof URL) return data.toString()
  return `data:${mediaType};base64,${Buffer.from(data).toString('base64')}`
}

const convertMessage = (message: LanguageModelV3Prompt[number]) => {
  switch (message.role) {
    case 'system':
      return { role: 'system' as const, content: message.content }
    case 'user':
      return {
        role: 'user' as const,
        content: message.content.map((part) =>
          part.type === 'text'
            ? { type: 'text' as const, text: part.text }
            : { type: 'image_url' as const, image_url: { url: toDataUrl(part) } },
        ),
      }
    case 'assistant':
      return {
        role: 'assistant' as const,
        content: message.content
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join(''),
      }
    case 'tool':
      return null // Arc backend doesn't support tool messages
  }
}

export const convertToArcMessages = (prompt: LanguageModelV3Prompt) =>
  prompt.map(convertMessage).filter((m) => m !== null)

// ============================================================================
// RESPONSE: Arc/OpenAI → AI SDK format
// ============================================================================

export function convertUsage(usage: ArcChatChunk['usage']): LanguageModelV3Usage {
  return {
    inputTokens: {
      total: usage?.prompt_tokens ?? undefined,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage?.completion_tokens ?? undefined,
      text: undefined,
      reasoning: usage?.completion_tokens_details?.reasoning_tokens ?? undefined,
    },
  }
}

export function mapFinishReason(reason: string | null | undefined): LanguageModelV3FinishReason {
  switch (reason) {
    case 'stop':
      return { unified: 'stop', raw: reason }
    case 'length':
      return { unified: 'length', raw: reason }
    case 'content_filter':
      return { unified: 'content-filter', raw: reason }
    case 'tool_calls':
      return { unified: 'tool-calls', raw: reason }
    default:
      return { unified: 'other', raw: reason ?? undefined }
  }
}
