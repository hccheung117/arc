import path from 'node:path'
import { BrowserWindow, Menu, dialog } from 'electron'
import { register } from '../router.js'
import * as sessionStore from '../services/session-store.js'
import { defineChannel, pushAll } from '../channel.js'

const popoutWindows = new Map()

const popoutsCh = defineChannel('session:popout:feed', () =>
  [...popoutWindows.keys()]
)

register('session:popout', async ({ sessionId }) => {
  const existing = popoutWindows.get(sessionId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 700,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return
    const spellItems = []
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        spellItems.push({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion),
        })
      }
      if (spellItems.length) spellItems.push({ type: 'separator' })
    }
    const editItems = Menu.buildFromTemplate([{ role: 'editMenu' }]).items[0].submenu.items
    Menu.buildFromTemplate([...spellItems, ...editItems]).popup({ frame: params.frame })
  })

  popoutWindows.set(sessionId, win)
  popoutsCh.push()

  win.on('close', async (e) => {
    if (!sessionStore.isStreaming(sessionId)) return
    e.preventDefault()
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Cancel', 'Stop & Close'],
      defaultId: 0,
      message: 'A response is still being generated.',
      detail: 'Closing this window will stop the current response.',
    })
    if (response === 0) return
    sessionStore.abort(sessionId)
    win.destroy()
  })

  win.on('closed', async () => {
    popoutWindows.delete(sessionId)
    popoutsCh.push()
    const { reloadSession } = await import('./session.js')
    reloadSession(sessionId)
  })

  win.webContents.on('did-finish-load', async () => {
    await pushAll()
    const { reloadSession } = await import('./session.js')
    await reloadSession(sessionId)
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?popout=${sessionId}`)
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { search: `popout=${sessionId}` },
    )
  }
})

export const closePopout = (sessionId) => {
  const win = popoutWindows.get(sessionId)
  if (win && !win.isDestroyed()) win.destroy()
}

register('session:popout:focus', ({ sessionId }) => {
  const win = popoutWindows.get(sessionId)
  if (win && !win.isDestroyed()) {
    win.focus()
    return true
  }
  return false
})
