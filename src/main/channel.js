import { push } from './router.js'

const channels = new Map()

export const defineChannel = (name, fetcher, { hydrate = true } = {}) => {
  const ch = {
    push: async (...args) => push(name, await fetcher(...args)),
    patch: (data) => push(name, data),
    mutate: (fn) => async (...args) => {
      const result = await fn(...args)
      await ch.push()
      return result
    },
  }
  if (hydrate) channels.set(name, ch)
  return ch
}

export const pushAll = async () => {
  for (const [, ch] of channels) await ch.push()
}
