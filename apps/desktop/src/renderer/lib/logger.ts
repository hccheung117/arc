const isDev = process.env.NODE_ENV !== 'production'

export const info = (tag: string, message: string): void => {
  if (isDev) {
    console.log(`[${tag}] ${message}`)
  }
}

export const warn = (tag: string, message: string): void => {
  if (isDev) {
    console.warn(`[${tag}] ${message}`)
  }
}

export const error = (tag: string, message: string, err?: Error): void => {
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
}
