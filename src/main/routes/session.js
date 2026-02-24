import { Menu } from 'electron'
import { register, registerStream, push } from '../router.js'
import * as session from '../services/session.js'

const pushSessions = () => push('session:listen', session.listSessions())

export { pushSessions }

register('session:list', () => session.listSessions())

register('session:context-menu', ({ id }) => {
  const chat = session.getSession(id)
  if (!chat) return
  Menu.buildFromTemplate([
    { label: chat.pinned ? 'Unpin' : 'Pin', click: () => { session.pinSession(id); pushSessions() } },
    { type: 'separator' },
    { label: 'Rename', click: () => push('session:rename-start', id) },
    { label: 'Duplicate', click: () => { session.duplicateSession(id); pushSessions() } },
    { type: 'separator' },
    { label: 'Delete', click: () => { session.deleteSession(id); pushSessions() } },
  ]).popup()
})

register('session:rename', ({ id, title }) => {
  session.renameSession(id, title)
  pushSessions()
})

registerStream('session:send', ({ send, signal }) => {
  return session.streamText(send, signal)
})
