/**
 * Messages JSON Log Capability Adapter
 *
 * Provides message log access using the ScopedJsonLog capability.
 * Message logs are stored as app/messages/{threadId}.jsonl.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'
import { StoredMessageEventSchema } from './business'

type ScopedJsonLog = ReturnType<FoundationCapabilities['jsonLog']>

export default defineCapability((jsonLog: ScopedJsonLog) => ({
  create: (threadId: string) => jsonLog.create(`app/messages/${threadId}.jsonl`, StoredMessageEventSchema),
}))
