import { z } from 'zod'
import { defineCapability } from '@main/kernel/module'

const WindowStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

const DEFAULT_SIZE = { width: 800, height: 600 }

export default defineCapability((jsonFile) => {
  const file = jsonFile.create('app/cache/window-state.cache.json', DEFAULT_SIZE, WindowStateSchema)
  return {
    readWindowState: () => file.read(),
    writeWindowState: (size) => file.write(size),
  }
})
