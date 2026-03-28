import { ipcMain } from 'electron'

let mainWindow = null
export const setMainWindow = (win) => { mainWindow = win }
export const getMainWindow = () => mainWindow

const routes = {}
const streamRoutes = {}
const activeStreams = new Map()
const streamsByWebContents = new Map()

export const register = (route, handler) => { routes[route] = handler }
export const registerStream = (route, handler) => { streamRoutes[route] = handler }

export const push = (route, data) => {
  const { BrowserWindow } = require('electron')
  const channel = `ipc:push:${route}`
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  }
}

export const dispatch = (route, payload) => routes[route](payload)
export const dispatchStream = (route, params) => streamRoutes[route]?.(params)

export const initIpc = () => {
  ipcMain.handle('ipc:invoke', (_, route, payload) => dispatch(route, payload))

  ipcMain.on('ipc:stream', (event, route, payload) => {
    const { requestId } = payload
    const channel = `ipc:stream:${requestId}`
    const send = (chunk) => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, chunk)
    }
    const controller = new AbortController()
    const wcId = event.sender.id
    activeStreams.set(requestId, controller)
    if (!streamsByWebContents.has(wcId)) streamsByWebContents.set(wcId, new Set())
    streamsByWebContents.get(wcId).add(requestId)
    Promise.resolve().then(() => streamRoutes[route]?.({ send, signal: controller.signal, requestId, ...payload }))
      .catch((e) => send({ type: 'error', errorText: e.message ?? 'Unexpected error' }))
      .finally(() => { activeStreams.delete(requestId); streamsByWebContents.get(wcId)?.delete(requestId) })
  })

  ipcMain.handle('ipc:stream:abort', (_, requestId) => {
    activeStreams.get(requestId)?.abort()
  })
}

export const hasActiveStreams = (webContentsId) => {
  const set = streamsByWebContents.get(webContentsId)
  return set ? set.size > 0 : false
}

export const abortStreams = (webContentsId) => {
  const set = streamsByWebContents.get(webContentsId)
  if (!set) return
  for (const reqId of set) activeStreams.get(reqId)?.abort()
}
