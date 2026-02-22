const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', Object.freeze({
  invoke: (route, payload) => ipcRenderer.invoke('ipc:invoke', route, payload),

  subscribe: (route, cb) => {
    const channel = `ipc:push:${route}`
    const listener = (_, data) => cb(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  stream: (route, payload, onChunk) => {
    const requestId = crypto.randomUUID()
    const channel = `ipc:stream:${requestId}`
    const listener = (_, chunk) => onChunk(chunk)
    ipcRenderer.on(channel, listener)
    ipcRenderer.send('ipc:stream', route, { ...payload, requestId })
    return () => {
      ipcRenderer.removeListener(channel, listener)
      ipcRenderer.invoke('ipc:invoke', 'stream:abort', { requestId })
    }
  },
}))
