/**
 * Persona IPC Handlers
 *
 * Routing layer for persona operations.
 * Pattern: IPC → Validate → Operation → Return
 */

import type { IpcMain } from 'electron'
import { z } from 'zod'
import { validated, register, broadcast } from '@main/foundation/ipc'
import type { PersonasEvent } from '@arc-types/arc-api'
import { listPersonas, createPersona } from '@main/lib/personas/operations'

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
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerPersonaHandlers(ipcMain: IpcMain): void {
  register(ipcMain, handlers)
}
