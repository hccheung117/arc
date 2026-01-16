/**
 * Persona IPC Handlers
 *
 * Routing layer for persona operations.
 * Pattern: IPC → Contract Validation → Operation → Broadcast → Return
 *
 * Two-layer architecture:
 * - Profile personas: read-only, from installed .arc archives
 * - User personas: read-write, can shadow profile personas
 */

import type { IpcMain } from 'electron'
import { broadcast } from '@main/foundation/ipc'
import { registerHandlers } from '@main/foundation/contract'
import { personasContract, type Persona } from '@contracts/personas'
import {
  listPersonas,
  createPersona,
  updatePersona,
  deletePersona,
} from '@main/lib/personas/operations'

// ============================================================================
// EVENT TYPES
// ============================================================================

type PersonasEvent =
  | { type: 'created'; persona: Persona }
  | { type: 'updated'; persona: Persona }
  | { type: 'deleted'; name: string }

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerPersonaHandlers(ipcMain: IpcMain): void {
  registerHandlers(ipcMain, personasContract, {
    list: async () => listPersonas(),

    create: async ({ name, systemPrompt }) => {
      const persona = await createPersona(name, systemPrompt)
      broadcast<PersonasEvent>('arc:personas:event', { type: 'created', persona })
      return persona
    },

    update: async ({ name, systemPrompt }) => {
      const persona = await updatePersona(name, systemPrompt)
      broadcast<PersonasEvent>('arc:personas:event', { type: 'updated', persona })
      return persona
    },

    delete: async ({ name }) => {
      await deletePersona(name)
      broadcast<PersonasEvent>('arc:personas:event', { type: 'deleted', name })
    },
  })
}
