import { ipcMain } from 'electron'

let mainWindow = null
export const setMainWindow = (win) => { mainWindow = win }
export const getMainWindow = () => mainWindow

const routes = {}
const streamRoutes = {}
const activeStreams = new Map()

export const register = (route, handler) => { routes[route] = handler }
export const registerStream = (route, handler) => { streamRoutes[route] = handler }

export const push = (route, data) => {
  mainWindow?.webContents.send(`ipc:push:${route}`, data)
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
    activeStreams.set(requestId, controller)
    Promise.resolve(streamRoutes[route]?.({ send, signal: controller.signal, requestId, ...payload }))
      .finally(() => activeStreams.delete(requestId))
  })

  ipcMain.handle('ipc:stream:abort', (_, requestId) => {
    activeStreams.get(requestId)?.abort()
  })
}
