/**
 * Persona IPC Handlers
 *
 * Routing layer for persona operations.
 * Pattern: IPC → Validate → Operation → Broadcast → Return
 *
 * Two-layer architecture:
 * - Profile personas: read-only, from installed .arc archives
 * - User personas: read-write, can shadow profile personas
 */

import type { IpcMain } from 'electron'
import { z } from 'zod'
import { validated, register, broadcast } from '@main/foundation/ipc'
import type { PersonasEvent } from '@arc-types/arc-api'
import {
  listPersonas,
  createPersona,
  updatePersona,
  deletePersona,
} from '@main/lib/personas/operations'

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  'arc:personas:list': listPersonas,

  'arc:personas:create': validated(
    [z.string(), z.string()],
    async (name: string, systemPrompt: string) => {
      const persona = await createPersona(name, systemPrompt)
      broadcast<PersonasEvent>('arc:personas:event', { type: 'created', persona })
      return persona
    },
  ),

  'arc:personas:update': validated(
    [z.string(), z.string()],
    async (name: string, systemPrompt: string) => {
      const persona = await updatePersona(name, systemPrompt)
      broadcast<PersonasEvent>('arc:personas:event', { type: 'updated', persona })
      return persona
    },
  ),

  'arc:personas:delete': validated([z.string()], async (name: string) => {
    await deletePersona(name)
    broadcast<PersonasEvent>('arc:personas:event', { type: 'deleted', name })
  }),
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerPersonaHandlers(ipcMain: IpcMain): void {
  register(ipcMain, handlers)
}
