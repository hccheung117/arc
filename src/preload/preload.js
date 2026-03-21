const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('api', Object.freeze({
  getFilePath: (file) => webUtils.getPathForFile(file),
  call: (route, payload, onChunk) => {
    if (typeof onChunk !== 'function')
      return ipcRenderer.invoke('ipc:invoke', route, payload)

    const requestId = crypto.randomUUID()
    const channel = `ipc:stream:${requestId}`
    const listener = (_, chunk) => {
      onChunk(chunk)
      if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
        ipcRenderer.removeListener(channel, listener)
      }
    }
    ipcRenderer.on(channel, listener)
    ipcRenderer.send('ipc:stream', route, { ...payload, requestId })
    return () => ipcRenderer.invoke('ipc:stream:abort', requestId)
  },

  on: (route, cb) => {
    const channel = `ipc:push:${route}`
    const listener = (_, data) => cb(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}))
