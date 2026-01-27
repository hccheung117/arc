/**
 * Prompt Derivation
 *
 * Pure functions for deriving UI-facing prompt properties from Prompt.
 * Single source of truth for all prompt-related UI logic.
 */

import type { Prompt } from '@main/modules/threads/json-file'
import type { Persona } from '@main/modules/personas/business'

/**
 * UI-facing prompt information derived from Prompt.
 *
 * Encapsulates all prompt-related UI logic:
 * - Header button styling (hasPrompt)
 * - Save blocking (isProtected)
 * - Edit affordances (isEditable)
 */
export interface PromptInfo {
  /** Whether thread has a prompt (direct or via persona) - for Header blue button */
  hasPrompt: boolean
  /** Whether prompt is read-only - blocks saves */
  isProtected: boolean
  /** Whether prompt can be edited - for UI affordances */
  isEditable: boolean
}

/**
 * Derive all UI-needed prompt properties from Prompt.
 *
 * Logic:
 * - type='none' → no prompt, editable
 * - type='inline' → has prompt, show content, editable
 * - type='persona' → lookup persona, show description if protected, content otherwise
 *
 * When prompt.type='persona', pass the resolved Persona to get correct UI state.
 * If persona not provided for persona type, returns safe defaults (protected, empty content).
 */
export function getPromptInfo(prompt: Prompt, persona?: Persona): PromptInfo {
  switch (prompt.type) {
    case 'none':
      return {
        hasPrompt: false,
        isProtected: false,
        isEditable: true,
      }

    case 'inline':
      return {
        hasPrompt: true,
        isProtected: false,
        isEditable: true,
      }

    case 'persona': {
      // No persona found - safe defaults (treat as protected to prevent accidental edits)
      if (!persona) {
        return {
          hasPrompt: true,
          isProtected: true,
          isEditable: false,
        }
      }

      const isProtected = persona.frontMatter.protected ?? false
      return {
        hasPrompt: true,
        isProtected,
        isEditable: !isProtected,
      }
    }
  }
}

/**
 * Derive editable content for system prompt editing.
 * Returns null if the prompt cannot be edited (protected persona).
 */
export function getEditableContent(
  prompt: Prompt,
  persona?: Persona
): string | null {
  switch (prompt.type) {
    case 'none':
      return ''
    case 'inline':
      return prompt.content
    case 'persona':
      if (!persona || (persona.frontMatter.protected ?? false)) return null
      return persona.systemPrompt
  }
}
