/**
 * Models Contract
 *
 * AI model listing operations.
 */

import { z } from 'zod'
import { contract, op } from '@main/foundation/contract'
import type { Model } from '@arc-types/models'

// ============================================================================
// CONTRACT
// ============================================================================

export const modelsContract = contract('models', {
  /** List available AI models */
  list: op(z.void(), [] as Model[]),
})
