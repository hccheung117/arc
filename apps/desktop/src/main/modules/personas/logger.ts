/**
 * Personas Logger Capability Adapter
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

export type Logger = FoundationCapabilities['logger']

export default defineCapability((logger: Logger) => logger)
