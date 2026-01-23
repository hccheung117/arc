/**
 * Settings JSON File Capability Adapter
 *
 * Provides settings persistence using the ScopedJsonFile capability.
 * Settings are stored in app/settings.json.
 */

import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const StoredFavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})

const StoredSettingsSchema = z.object({
  activeProfileId: z.string().nullable(),
  favorites: z.array(StoredFavoriteSchema),
})

type StoredSettings = z.infer<typeof StoredSettingsSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: StoredSettings = {
  activeProfileId: null,
  favorites: [],
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability
// ─────────────────────────────────────────────────────────────────────────────

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const file = jsonFile.create('app/settings.json', DEFAULT_SETTINGS, StoredSettingsSchema)
  return {
    read: () => file.read(),
    update: (fn: (data: StoredSettings) => StoredSettings) => file.update(fn),
  }
})
