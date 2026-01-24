/**
 * Threads JSON File Capability Adapter
 *
 * Provides thread index access using the ScopedJsonFile capability.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'
// eslint-disable-next-line no-restricted-imports -- Schema import from declared dependency
import { StoredThreadIndexSchema, type StoredThreadIndex } from '@main/modules/messages/business'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

const DEFAULT_INDEX: StoredThreadIndex = { threads: [] }

export default defineCapability((jsonFile: ScopedJsonFile) => ({
  threadIndex: jsonFile.create('app/messages/index.json', DEFAULT_INDEX, StoredThreadIndexSchema),
}))
