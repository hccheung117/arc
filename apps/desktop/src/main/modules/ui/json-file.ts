import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

const WindowStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

const DEFAULT_SIZE = { width: 800, height: 600 }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const file = jsonFile.create('app/cache/window-state.cache.json', DEFAULT_SIZE, WindowStateSchema)
  return {
    readWindowState: () => file.read(),
    writeWindowState: (size: { width: number; height: number }) => file.write(size),
  }
})
