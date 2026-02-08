import { defineCapability } from '@main/kernel/module'

const adaptLogger = (logger) => ({
  log: (msg) => logger.info(msg),
  info: (msg) => logger.info(msg),
  warn: (msg) => logger.warn(msg),
  error: (msg) => logger.error(msg),
})

export default defineCapability(adaptLogger)
