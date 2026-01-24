/**
 * Messages JSON File Capability Adapter
 *
 * Provides thread index persistence using the ScopedJsonFile capability.
 * Thread index is stored at app/messages/index.json.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'
import { StoredThreadIndexSchema, type StoredThreadIndex } from './business'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

const DEFAULT_INDEX: StoredThreadIndex = { threads: [] }

export default defineCapability((jsonFile: ScopedJsonFile) => ({
  threadIndex: jsonFile.create('app/messages/index.json', DEFAULT_INDEX, StoredThreadIndexSchema),
}))
