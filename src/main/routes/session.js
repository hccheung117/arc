import { Menu } from 'electron'
import { register, registerStream, push } from '../router.js'
import { resolve } from '../arcfs.js'
import * as session from '../services/session.js'

const dir = resolve('sessions')

const pushSessions = async () =>
  push('session:listen', await session.listSessions(dir))

export { pushSessions }

register('session:list', () => session.listSessions(dir))

register('session:create', async ({ title } = {}) => {
  const id = await session.createSession(dir, title)
  await pushSessions()
  return id
})

register('session:context-menu', async ({ id }) => {
  const chat = await session.getSession(dir, id)
  if (!chat) return
  Menu.buildFromTemplate([
    { label: chat.pinned ? 'Unpin' : 'Pin', click: async () => { await session.pinSession(dir, id); pushSessions() } },
    { type: 'separator' },
    { label: 'Rename', click: () => push('session:rename-start', id) },
    { label: 'Duplicate', click: async () => { await session.duplicateSession(dir, id); pushSessions() } },
    { type: 'separator' },
    { label: 'Delete', click: async () => { await session.deleteSession(dir, id); pushSessions() } },
  ]).popup()
})

register('session:rename', async ({ id, title }) => {
  await session.renameSession(dir, id, title)
  await pushSessions()
})

registerStream('session:send', ({ send, signal }) => {
  return session.streamText(send, signal)
})
