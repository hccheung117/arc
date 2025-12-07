const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  /**
   * Info-level log. Dev only (console).
   */
  info(tag: string, message: string): void {
    if (isDev) {
      console.log(`[${tag}] ${message}`)
    }
  },

  /**
   * Warning-level log. Dev only (console).
   */
  warn(tag: string, message: string): void {
    if (isDev) {
      console.warn(`[${tag}] ${message}`)
    }
  },

  /**
   * Error-level log. Console in dev, IPC to main in prod (for file logging).
   */
  error(tag: string, message: string, err?: Error): void {
    const stack = err?.stack

    if (isDev) {
      if (stack) {
        console.error(`[${tag}] ${message}\n${stack}`)
      } else {
        console.error(`[${tag}] ${message}`)
      }
    } else {
      window.arc.log.error(tag, message, stack)
    }
  },
}
