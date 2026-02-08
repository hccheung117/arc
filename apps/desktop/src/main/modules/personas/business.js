/**
 * Persona Business Logic
 *
 * Pure domain logic for persona CRUD and prompt resolution.
 * Two-layer resolution: user personas shadow profile personas.
 */

// ============================================================================
// VALIDATION
// ============================================================================

// File system reserved characters (cross-platform)
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/
// Leading/trailing whitespace or dots cause file system issues
const EDGE_WHITESPACE_OR_DOT = /^[\s.]|[\s.]$/

export function isValidPersonaName(name) {
  if (name.length < 1 || name.length > 50) return false
  if (FORBIDDEN_CHARS.test(name)) return false
  if (EDGE_WHITESPACE_OR_DOT.test(name)) return false
  return true
}

// ============================================================================
// HELPERS
// ============================================================================

const toPersona = (name, parsed, source) => ({
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

export async function listPersonas(caps, activeProfile) {
  const { markdownFile, glob, logger } = caps

  // Gather profile personas
  const profilePersonas = []
  if (activeProfile) {
    const profileNames = await glob.listProfilePersonaNames(activeProfile)
    for (const name of profileNames) {
      const parsed = await markdownFile.readProfilePersona(activeProfile, name)
      if (parsed) {
        profilePersonas.push(toPersona(name, parsed, 'profile'))
      } else {
        logger.warn(`Skipping profile persona "${name}": missing PERSONA.md`)
      }
    }
  }

  // Gather user personas
  const userNames = await glob.listUserPersonaNames()
  const userPersonas = []
  for (const name of userNames) {
    const parsed = await markdownFile.readUserPersona(name)
    if (parsed) {
      userPersonas.push(toPersona(name, parsed, 'user'))
    } else {
      logger.warn(`Skipping user persona "${name}": missing PERSONA.md`)
    }
  }

  // Merge: user personas shadow profile personas
  const userNameSet = new Set(userNames)
  const merged = [
    ...profilePersonas.filter(p => !userNameSet.has(p.name)),
    ...userPersonas,
  ]

  return merged.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function getPersona(caps, activeProfile, name) {
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

export async function createPersona(caps, name, systemPrompt) {
  const { markdownFile } = caps

  if (!isValidPersonaName(name)) {
    throw new Error(
      'Persona name must be 1-50 characters without special characters (/ \\ : * ? " < > |)'
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

export async function updatePersona(caps, name, systemPrompt) {
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

export async function deletePersona(caps, name) {
  const { markdownFile, binaryFile } = caps

  const existing = await markdownFile.readUserPersona(name)
  if (!existing) {
    throw new Error(`User persona "${name}" not found`)
  }

  await binaryFile.deleteUserPersonaDir(name)
}

export async function resolvePrompt(
  caps,
  activeProfile,
  prompt
) {
  switch (prompt.type) {
    case 'none':
      return null

    case 'inline':
      return prompt.content

    case 'persona': {
      const persona = await getPersona(caps, activeProfile, prompt.ref)

      if (!persona) {
        caps.logger.warn(
          `Persona "${prompt.ref}" not found (may have been deleted or profile changed)`
        )
        return null
      }

      return persona.systemPrompt
    }
  }
}
