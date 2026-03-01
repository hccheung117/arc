import { Menu, clipboard } from 'electron'
import { register, push } from '../router.js'
import { resolve } from '../arcfs.js'
import * as session from '../services/session.js'

const dir = resolve('sessions')

register('message:context-menu', ({ id, role, text }) => {
  const menus = {
    user: [
      { label: 'Copy', click: () => clipboard.writeText(text) },
      { label: 'Edit', click: () => push('message:edit-start', { id, role }) },
    ],
    assistant: [
      { label: 'Copy', click: () => clipboard.writeText(text) },
      { label: 'Fork', click: () => push('message:fork', { id }) },
      { label: 'Edit', click: () => push('message:edit-start', { id, role }) },
    ],
  }

  Menu.buildFromTemplate(menus[role]).popup()
})

register('message:switch-branch', ({ sessionId, targetId }) =>
  session.switchBranch(dir, sessionId, targetId))
