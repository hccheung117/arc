/**
 * UI JSON File Capability Adapter
 *
 * Provides window state persistence using the ScopedJsonFile capability.
 * Window state is stored in app/cache/window-state.cache.json.
 */

import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = FoundationCapabilities['jsonFile']

const WindowStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

const DEFAULT_SIZE = { width: 800, height: 600 }
const MIN_SIZE = { width: 700, height: 550 }

type WindowState = { width: number; height: number }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const windowState = jsonFile.create('cache/window-state.cache.json', DEFAULT_SIZE, WindowStateSchema)
  return {
    windowState: {
      read: () => windowState.read(),
      write: (data: WindowState) => windowState.write(data),
    },
    constants: { DEFAULT_SIZE, MIN_SIZE },
  }
})
