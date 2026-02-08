/**
 * Threads JSON File Capability Adapter
 *
 * Library for business: absorbs thread index schema, path, and persistence format.
 * Owns the thread index data structure.
 */

import { z } from 'zod'
import { defineCapability } from '@main/kernel/module'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (thread index data — owned by threads module)
// ─────────────────────────────────────────────────────────────────────────────

export const PromptSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('inline'), content: z.string() }),
  z.object({ type: z.literal('persona'), ref: z.string() }),
])

// Recursive type requires explicit annotation
const StoredThreadSchema = z.object({
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

// ─────────────────────────────────────────────────────────────────────────────
// Capability
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INDEX = { threads: [] }

export default defineCapability((jsonFile) => {
  const index = jsonFile.create('app/messages/index.json', DEFAULT_INDEX, StoredThreadIndexSchema)

  return {
    read: () => index.read(),
    write: (data) => index.write(data),
    update: (updater) => index.update(updater),
  }
})
