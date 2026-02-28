import { dispatch, dispatchStream } from '@main/router.js'

export const createClient = () => ({
  call: (route, payload, onChunk) => {
    if (typeof onChunk !== 'function')
      return dispatch(route, payload)
    const controller = new AbortController()
    dispatchStream(route, { ...payload, send: onChunk, signal: controller.signal })
    return () => controller.abort()
  },
})
