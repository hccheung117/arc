import { z } from 'zod'
import { defineCapability } from '@main/kernel/module'

const FrontMatterSchema = z.object({
  name: z.string().optional(),
  protected: z.boolean().optional(),
  description: z.string().optional(),
})

const parseFrontMatter = (raw) => {
  const parsed = FrontMatterSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

export default defineCapability((mdFile) => ({
  readUserPersona: async (name) => {
    const result = await mdFile.read(`app/personas/${name}/PERSONA.md`)
    if (!result) return null
    return { frontMatter: parseFrontMatter(result.frontMatter), systemPrompt: result.body }
  },

  writeUserPersona: async (name, body, frontMatter) => {
    await mdFile.write(`app/personas/${name}/PERSONA.md`, body, frontMatter)
  },

  readProfilePersona: async (profileId, name) => {
    const result = await mdFile.read(`profiles/${profileId}/personas/${name}/PERSONA.md`)
    if (!result) return null
    return { frontMatter: parseFrontMatter(result.frontMatter), systemPrompt: result.body }
  },
}))
