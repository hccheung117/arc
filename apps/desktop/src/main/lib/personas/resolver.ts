/**
 * Prompt Source Resolution
 *
 * Pure domain logic for resolving PromptSource → systemPrompt.
 * Called at AI API time to inject resolved prompts into streaming context.
 */

import type { PromptSource } from '@main/modules/messages/business'
import { warn } from '@main/foundation/logger'
import { getPersona } from './operations'

/**
 * Resolve a PromptSource to its systemPrompt content.
 *
 * Resolution strategy:
 * - type='none' → null
 * - type='direct' → content
 * - type='persona' → look up persona and return systemPrompt
 *
 * Gracefully handles missing personas (logs warning, returns null).
 */
export async function resolvePromptSource(
  promptSource: PromptSource
): Promise<string | null> {
  switch (promptSource.type) {
    case 'none':
      return null

    case 'direct':
      return promptSource.content

    case 'persona': {
      const persona = await getPersona(promptSource.personaId)

      if (!persona) {
        warn(
          'personas',
          `Persona "${promptSource.personaId}" not found (may have been deleted or profile changed)`
        )
        return null
      }

      return persona.systemPrompt
    }
  }
}
