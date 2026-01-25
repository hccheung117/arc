/**
 * Persona Business Logic
 *
 * Pure domain logic for persona CRUD and prompt resolution.
 * Two-layer resolution: user personas shadow profile personas.
 */

import type { ParsedPersona, PersonaFrontMatter } from './markdown-file'
import type { Logger } from './logger'

// ============================================================================
// TYPES
// ============================================================================

export type PromptSource =
  | { type: 'none' }
  | { type: 'direct'; content: string }
  | { type: 'persona'; personaId: string }

export interface Persona {
  name: string
  displayName: string
  systemPrompt: string
  source: 'profile' | 'user'
  createdAt: string
  frontMatter: PersonaFrontMatter
}

export type MarkdownFileCap = {
  readUserPersona: (name: string) => Promise<ParsedPersona | null>
  writeUserPersona: (name: string, body: string, frontMatter?: PersonaFrontMatter) => Promise<void>
  readProfilePersona: (profileId: string, name: string) => Promise<ParsedPersona | null>
}

export type BinaryFileCap = {
  deleteUserPersonaDir: (name: string) => Promise<void>
}

export type GlobCap = {
  listUserPersonaNames: () => Promise<string[]>
  listProfilePersonaNames: (profileId: string) => Promise<string[]>
}

type Caps = {
  markdownFile: MarkdownFileCap
  binaryFile: BinaryFileCap
  glob: GlobCap
  logger: Logger
}

// ============================================================================
// VALIDATION
// ============================================================================

const PERSONA_NAME_REGEX = /^[a-zA-Z0-9_-]+$/

export function isValidPersonaName(name: string): boolean {
  return name.length >= 1 && name.length <= 50 && PERSONA_NAME_REGEX.test(name)
}

// ============================================================================
// HELPERS
// ============================================================================

const toPersona = (name: string, parsed: ParsedPersona, source: 'profile' | 'user'): Persona => ({
  name,
  displayName: parsed.frontMatter.name ?? name,
  systemPrompt: parsed.systemPrompt,
  source,
  createdAt: '',
  frontMatter: parsed.frontMatter,
})

// ============================================================================
// OPERATIONS
// ============================================================================

export async function listPersonas(caps: Caps, activeProfile: string | null): Promise<Persona[]> {
  const { markdownFile, glob } = caps

  // Gather profile personas
  const profilePersonas: Persona[] = []
  if (activeProfile) {
    const profileNames = await glob.listProfilePersonaNames(activeProfile)
    for (const name of profileNames) {
      const parsed = await markdownFile.readProfilePersona(activeProfile, name)
      if (parsed) profilePersonas.push(toPersona(name, parsed, 'profile'))
    }
  }

  // Gather user personas
  const userNames = await glob.listUserPersonaNames()
  const userPersonas: Persona[] = []
  for (const name of userNames) {
    const parsed = await markdownFile.readUserPersona(name)
    if (parsed) userPersonas.push(toPersona(name, parsed, 'user'))
  }

  // Merge: user personas shadow profile personas
  const userNameSet = new Set(userNames)
  const merged = [
    ...profilePersonas.filter(p => !userNameSet.has(p.name)),
    ...userPersonas,
  ]

  return merged.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function getPersona(caps: Caps, activeProfile: string | null, name: string): Promise<Persona | null> {
  const { markdownFile } = caps

  // User layer first (shadow)
  const userParsed = await markdownFile.readUserPersona(name)
  if (userParsed) return toPersona(name, userParsed, 'user')

  // Profile layer
  if (activeProfile) {
    const profileParsed = await markdownFile.readProfilePersona(activeProfile, name)
    if (profileParsed) return toPersona(name, profileParsed, 'profile')
  }

  return null
}

export async function createPersona(caps: Caps, name: string, systemPrompt: string): Promise<Persona> {
  const { markdownFile } = caps

  if (!isValidPersonaName(name)) {
    throw new Error(
      'Persona name must be 1-50 characters, using only letters, numbers, underscore, and hyphen'
    )
  }

  // Check if already exists
  const existing = await markdownFile.readUserPersona(name)
  if (existing) {
    throw new Error(`Persona "${name}" already exists`)
  }

  await markdownFile.writeUserPersona(name, systemPrompt)

  return {
    name,
    displayName: name,
    systemPrompt,
    source: 'user',
    createdAt: new Date().toISOString(),
    frontMatter: {},
  }
}

export async function updatePersona(caps: Caps, name: string, systemPrompt: string): Promise<Persona> {
  const { markdownFile } = caps

  const existing = await markdownFile.readUserPersona(name)
  if (!existing) {
    throw new Error(`User persona "${name}" not found`)
  }

  // Preserve existing front matter
  const frontMatter = existing.frontMatter
  await markdownFile.writeUserPersona(name, systemPrompt, frontMatter)

  return {
    name,
    displayName: frontMatter.name ?? name,
    systemPrompt,
    source: 'user',
    createdAt: '',
    frontMatter,
  }
}

export async function deletePersona(caps: Caps, name: string): Promise<void> {
  const { markdownFile, binaryFile } = caps

  const existing = await markdownFile.readUserPersona(name)
  if (!existing) {
    throw new Error(`User persona "${name}" not found`)
  }

  await binaryFile.deleteUserPersonaDir(name)
}

export async function resolvePromptSource(
  caps: Caps,
  activeProfile: string | null,
  promptSource: PromptSource
): Promise<string | null> {
  switch (promptSource.type) {
    case 'none':
      return null

    case 'direct':
      return promptSource.content

    case 'persona': {
      const persona = await getPersona(caps, activeProfile, promptSource.personaId)

      if (!persona) {
        caps.logger.warn(
          `Persona "${promptSource.personaId}" not found (may have been deleted or profile changed)`
        )
        return null
      }

      return persona.systemPrompt
    }
  }
}
