import { ipcMain } from 'electron'

let mainWindow = null
export const setMainWindow = (win) => { mainWindow = win }

const routes = {}
const streamRoutes = {}

export const register = (route, handler) => { routes[route] = handler }
export const registerStream = (route, handler) => { streamRoutes[route] = handler }

export const push = (route, data) => {
  mainWindow?.webContents.send(`ipc:push:${route}`, data)
}

const dispatch = (route, payload) => routes[route](payload)

export const initIpc = () => {
  ipcMain.handle('ipc:invoke', (_, route, payload) => dispatch(route, payload))

  ipcMain.on('ipc:stream', (event, route, payload) => {
    const { requestId } = payload
    const channel = `ipc:stream:${requestId}`
    const send = (chunk) => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, chunk)
    }
    streamRoutes[route]?.({ send, requestId, ...payload })
  })
}
