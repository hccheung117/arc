/**
 * Threads JSON File Capability Adapter
 *
 * Library for business: absorbs thread index schema, path, and persistence format.
 * Owns the thread index data structure.
 */

import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (thread index data — owned by threads module)
// ─────────────────────────────────────────────────────────────────────────────

export const PromptSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('inline'), content: z.string() }),
  z.object({ type: z.literal('persona'), ref: z.string() }),
])

// Recursive type requires explicit annotation
type StoredThreadType = {
  id: string
  title: string | null
  pinned: boolean
  renamed: boolean
  prompt: Prompt
  createdAt: string
  updatedAt: string
  children: StoredThreadType[]
}

const StoredThreadSchema: z.ZodType<StoredThreadType> = z.object({
  id: z.string(),
  title: z.string().nullable(),
  pinned: z.boolean(),
  renamed: z.boolean(),
  prompt: PromptSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  children: z.lazy(() => z.array(StoredThreadSchema)).default([]),
})

export const StoredThreadIndexSchema = z.object({
  threads: z.array(StoredThreadSchema),
})

export type Prompt = z.infer<typeof PromptSchema>
export type StoredThread = StoredThreadType
export type StoredThreadIndex = z.infer<typeof StoredThreadIndexSchema>

export type ThreadConfig = {
  prompt: Prompt
  title?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INDEX: StoredThreadIndex = { threads: [] }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const index = jsonFile.create('app/messages/index.json', DEFAULT_INDEX, StoredThreadIndexSchema)

  return {
    read: () => index.read(),
    write: (data: StoredThreadIndex) => index.write(data),
    update: (updater: (data: StoredThreadIndex) => StoredThreadIndex) => index.update(updater),
  }
})
