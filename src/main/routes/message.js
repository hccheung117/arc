import { Menu, clipboard } from 'electron'
import { register, push } from '../router.js'

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
