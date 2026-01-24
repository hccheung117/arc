/**
 * Threads JSON Log Capability Adapter
 *
 * Provides message log access for thread duplication operations.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'
// eslint-disable-next-line no-restricted-imports -- Schema import from declared dependency
import { StoredMessageEventSchema } from '@main/modules/messages/business'

type ScopedJsonLog = ReturnType<FoundationCapabilities['jsonLog']>

export default defineCapability((jsonLog: ScopedJsonLog) => ({
  create: (threadId: string) => jsonLog.create(`app/messages/${threadId}.jsonl`, StoredMessageEventSchema),
}))
