import { Menu, clipboard, shell, app } from 'electron'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { register, push } from '../router.js'
import { resolve, fromUrl } from '../arcfs.js'
import * as session from '../services/session.js'
import * as message from '../services/message.js'
import { pushSessions, pushSessionState } from './session.js'

const dir = resolve('sessions')

register('message:context-menu', ({ sessionId, id, role, text }) => {
  const menus = {
    user: [
      { label: 'Copy', click: () => clipboard.writeText(text) },
      { label: 'Edit', click: () => push('message:edit-start', { id, role }) },
    ],
    assistant: [
      { label: 'Copy', click: () => clipboard.writeText(text) },
      { label: 'Fork', click: async () => {
        const newId = await session.forkSession(dir, sessionId, id)
        if (!newId) return
        await pushSessions()
        push('session:navigate', newId)
      }},
      { label: 'Edit', click: () => push('message:edit-start', { id, role }) },
    ],
  }

  Menu.buildFromTemplate(menus[role]).popup()
})

register('message:edit-save', async ({ sessionId, messageId, text }) => {
  const newId = await message.editMessage(dir, sessionId, messageId, text)
  const { messages, branches } = await message.loadMessages(dir, sessionId, newId)
  pushSessionState(sessionId, { messages, branches })
})

register('message:switch-branch', async ({ sessionId, targetId }) => {
  const { messages, branches } = await message.switchBranch(dir, sessionId, targetId)
  pushSessionState(sessionId, { messages, branches })
})

register('message:open-file', async ({ url, path, data, filename }) => {
  if (url) return shell.openPath(fromUrl(url))
  if (path) return shell.openPath(path)
  const tmp = join(app.getPath('temp'), filename)
  await fs.writeFile(tmp, Buffer.from(data))
  await shell.openPath(tmp)
})

register('message:upload-attachment', ({ data, path, filename, mediaType }) =>
  message.uploadAttachment(resolve('tmp'), { data, path, filename, mediaType })
)
