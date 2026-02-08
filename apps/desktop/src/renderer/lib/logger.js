const isDev = process.env.NODE_ENV !== 'production'

export const info = (tag, message) => {
  if (isDev) {
    console.log(`[${tag}] ${message}`)
  }
}

export const warn = (tag, message) => {
  if (isDev) {
    console.warn(`[${tag}] ${message}`)
  }
}

export const error = (tag, message, err) => {
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
