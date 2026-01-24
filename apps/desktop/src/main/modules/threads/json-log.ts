/**
 * Threads JSON Log Capability Adapter
 *
 * Provides message log access for thread duplication operations.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'
// eslint-disable-next-line no-restricted-imports -- Schema from declared dependency (messages)
import { StoredMessageEventSchema } from '@main/modules/messages/json-log'

type ScopedJsonLog = ReturnType<FoundationCapabilities['jsonLog']>

export default defineCapability((jsonLog: ScopedJsonLog) => ({
  create: (threadId: string) => jsonLog.create(`app/messages/${threadId}.jsonl`, StoredMessageEventSchema),
}))
