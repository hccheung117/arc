/**
 * UI Logger Capability Adapter
 *
 * Provides a scoped logger for the UI module.
 * The logger is received via dependency injection from the kernel.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type Logger = FoundationCapabilities['logger']

export default defineCapability((logger: Logger) => logger)
