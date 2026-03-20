import { Menu, clipboard, shell, app } from 'electron'
import { register, push } from '../router.js'
import { resolve, fromUrl } from '../arcfs.js'
import * as message from '../services/message.js'
import { sessionState, forkFromMessage } from './session.js'

const dir = resolve('sessions')

register('message:context-menu', ({ sessionId, id, role, text, selection }) => {
  const copyText = selection || text
  const menus = {
    user: [
      { label: 'Copy', click: () => clipboard.writeText(copyText) },
      { label: 'Edit', click: () => push('message:edit:start', { id, role }) },
    ],
    assistant: [
      { label: 'Copy', click: () => clipboard.writeText(copyText) },
      { label: 'Fork', click: () => forkFromMessage(sessionId, id) },
      { label: 'Edit', click: () => push('message:edit:start', { id, role }) },
    ],
  }

  Menu.buildFromTemplate(menus[role]).popup()
})

register('message:edit-save', async ({ sessionId, messageId, text }) => {
  const newId = await message.editMessage(dir, sessionId, messageId, text)
  const { messages, branches } = await message.loadMessages(dir, sessionId, newId)
  sessionState.patch({ sessionId, messages: message.stripSyntheticParts(messages), branches })
})

register('message:switch-branch', async ({ sessionId, targetId }) => {
  const { messages, branches } = await message.switchBranch(dir, sessionId, targetId)
  sessionState.patch({ sessionId, messages: message.stripSyntheticParts(messages), branches })
})

register('message:open-file', async ({ url, path, data, filename }) => {
  if (url) return shell.openPath(fromUrl(url))
  if (path) return shell.openPath(path)
  shell.openPath(await message.writeTempFile(app.getPath('temp'), filename, data))
})

register('message:upload-attachment', ({ data, path, filename, mediaType }) =>
  message.uploadAttachment(resolve('tmp'), { data, path, filename, mediaType })
)
