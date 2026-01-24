import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type Logger = FoundationCapabilities['logger']

const adaptLogger = (logger: Logger) => ({
  log: (msg: string) => logger.info(msg),
  info: (msg: string) => logger.info(msg),
  warn: (msg: string) => logger.warn(msg),
  error: (msg: string) => logger.error(msg),
})

export default defineCapability(adaptLogger)
