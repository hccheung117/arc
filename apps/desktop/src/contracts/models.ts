/**
 * Models Contract
 *
 * AI model listing operations.
 */

import { z } from 'zod'
import { contract, op } from '@main/foundation/contract'

// ============================================================================
// TYPES
// ============================================================================

export interface Provider {
  id: string
  name: string
  type: 'openai'
}

export interface Model {
  id: string
  name: string
  provider: Provider
}

// ============================================================================
// CONTRACT
// ============================================================================

export const modelsContract = contract('models', {
  /** List available AI models */
  list: op(z.void(), [] as Model[]),
})
