/**
 * Updater Logger Capability Adapter
 *
 * Adapts foundation logger to update-electron-app's ILogger interface.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type Logger = FoundationCapabilities['logger']

/**
 * Adapt Foundation Logger to update-electron-app's ILogger interface.
 * Adds the missing log() method required by the library.
 */
const adaptLogger = (logger: Logger) => ({
  log: (msg: string) => logger.info(msg),
  info: (msg: string) => logger.info(msg),
  warn: (msg: string) => logger.warn(msg),
  error: (msg: string) => logger.error(msg),
})

export default defineCapability(adaptLogger)

/**
 * Temporary export for pre-P5 direct imports.
 * Use this in lifecycle.ts until module system is fully wired.
 */
export const createUpdaterLogger = adaptLogger
