import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedMarkdownFile = ReturnType<FoundationCapabilities['markdownFile']>

const FrontMatterSchema = z.object({
  name: z.string().optional(),
  protected: z.boolean().optional(),
  description: z.string().optional(),
})

export type PersonaFrontMatter = z.infer<typeof FrontMatterSchema>

export interface ParsedPersona {
  frontMatter: PersonaFrontMatter
  systemPrompt: string
}

const parseFrontMatter = (raw: Record<string, unknown>): PersonaFrontMatter => {
  const parsed = FrontMatterSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

export default defineCapability((mdFile: ScopedMarkdownFile) => ({
  readUserPersona: async (name: string): Promise<ParsedPersona | null> => {
    const result = await mdFile.read(`app/personas/${name}/PERSONA.md`)
    if (!result) return null
    return { frontMatter: parseFrontMatter(result.frontMatter), systemPrompt: result.body }
  },

  writeUserPersona: async (name: string, body: string, frontMatter?: PersonaFrontMatter): Promise<void> => {
    await mdFile.write(`app/personas/${name}/PERSONA.md`, body, frontMatter)
  },

  readProfilePersona: async (profileId: string, name: string): Promise<ParsedPersona | null> => {
    const result = await mdFile.read(`profiles/${profileId}/personas/${name}/PERSONA.md`)
    if (!result) return null
    return { frontMatter: parseFrontMatter(result.frontMatter), systemPrompt: result.body }
  },
}))
