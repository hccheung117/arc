import fs from 'node:fs/promises'
import { dialog, Menu } from 'electron'
import { register, registerStream, push, getMainWindow } from '../router.js'
import { defineChannel } from '../channel.js'
import { resolve } from '../arcfs.js'
import * as session from '../services/session.js'
import * as layout from '../services/layout.js'
import * as message from '../services/message.js'
import { promptsCh } from './prompts.js'

const dir = resolve('sessions')

const sessions = defineChannel('session:feed', async () => {
  const [list, folders] = await Promise.all([
    session.listSessions(dir),
    layout.listFolders(dir),
  ])
  return { sessions: list, folders }
})

const sessionState = defineChannel('session:state:feed', async (sessionId) => {
  const { messages, branches } = await message.loadMessages(dir, sessionId)
  const prompt = await session.loadPrompt(dir, sessionId)
  return { sessionId, messages: message.stripSyntheticParts(messages), branches, prompt }
}, { hydrate: false })

const forkFromMessage = async (sessionId, messageId) => {
  const newId = await session.forkSession(dir, sessionId, messageId)
  if (!newId) return
  await sessions.push()
  push('session:navigate:feed', newId)
}

export { sessions, sessionState, forkFromMessage }

register('session:list', () => session.listSessions(dir))

register('session:context-menu', async ({ id }) => {
  const chat = await session.getSession(dir, id)
  if (!chat) return
  const folders = await layout.listFolders(dir)
  const folderIdx = folders.findIndex(f => f.sessions.includes(id))
  const inFolder = folderIdx !== -1

  const moveSubmenu = [
    ...folders
      .map((f, i) => ({ label: f.name, click: sessions.mutate(() => layout.moveToFolder(dir, id, i)) }))
      .filter((_, i) => i !== folderIdx),
    ...(folders.length > (inFolder ? 1 : 0) ? [{ type: 'separator' }] : []),
    { label: 'New Folder', click: async () => {
      await layout.createFolder(dir, 'New Folder', id)
      await sessions.push()
      const updated = await layout.listFolders(dir)
      push('session:folder-rename:start', updated.length - 1)
    } },
  ]

  Menu.buildFromTemplate([
    ...(!inFolder ? [
      { label: chat.pinned ? 'Unpin' : 'Pin', click: sessions.mutate(() => layout.pinSession(dir, id)) },
      { type: 'separator' },
    ] : []),
    { label: 'Rename', click: () => push('session:rename:start', id) },
    { label: 'Duplicate', click: sessions.mutate(async () => {
      const newId = await session.duplicateSession(dir, id)
      if (inFolder && newId) await layout.moveToFolder(dir, newId, folderIdx)
    }) },
    { type: 'separator' },
    ...(inFolder ? [{ label: 'Remove from Folder', click: sessions.mutate(() => layout.removeFromFolder(dir, id)) }] : []),
    { label: 'Move to Folder', submenu: moveSubmenu },
    { type: 'separator' },
    { label: 'Delete', click: sessions.mutate(() => session.deleteSession(dir, id)) },
  ]).popup()
})

register('session:rename', sessions.mutate(({ id, title }) => session.renameSession(dir, id, title)))
register('session:create-folder', sessions.mutate(({ name, id }) => layout.createFolder(dir, name, id)))
register('session:move-to-folder', sessions.mutate(({ id, folderIndex }) => layout.moveToFolder(dir, id, folderIndex)))
register('session:remove-from-folder', sessions.mutate(({ id }) => layout.removeFromFolder(dir, id)))
register('session:rename-folder', sessions.mutate(({ folderIndex, name }) => layout.renameFolder(dir, folderIndex, name)))
register('session:delete-folder', sessions.mutate(({ folderIndex }) => layout.deleteFolder(dir, folderIndex)))
register('session:toggle-folder-collapse', sessions.mutate(({ folderIndex }) => layout.toggleFolderCollapse(dir, folderIndex)))

register('session:folder-context-menu', ({ folderIndex }) => {
  Menu.buildFromTemplate([
    { label: 'Rename', click: () => push('session:folder-rename:start', folderIndex) },
    { label: 'Delete', click: sessions.mutate(() => layout.deleteFolder(dir, folderIndex)) },
  ]).popup()
})

register('session:activate', ({ sessionId }) => sessionState.push(sessionId))

register('session:export', async ({ sessionId }) => {
  const content = await message.exportMarkdown(dir, sessionId)
  const meta = await session.getSession(dir, sessionId)
  const raw = meta?.title ?? 'Chat'
  const safe = raw.replace(/[/\\:*?"<>|]/g, '_').replace(/[\x00-\x1f]/g, '_').trim() || 'Chat'
  const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow(), {
    defaultPath: `Arc - ${safe}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (canceled || !filePath) return false
  await fs.writeFile(filePath, content, 'utf-8')
  return true
})

register('session:link-prompt', async ({ id, promptRef }) => {
  await session.linkPrompt(dir, id, promptRef)
  const prompt = await session.loadPrompt(dir, id)
  sessionState.patch({ sessionId: id, prompt })
})

register('session:save-prompt', async ({ id, content }) => {
  const shared = await session.savePrompt(dir, id, content)
  if (shared) await promptsCh.push()
  const prompt = await session.loadPrompt(dir, id)
  sessionState.patch({ sessionId: id, prompt })
})

// [DETECT-MAIN] activeSkill is no longer in the payload from the renderer.
// It is detected from message text inside prepareSend (services/session.js).
registerStream('session:send', async ({ sessionId, messages: inputMessages, promptRef, providerId, modelId, send, signal }) => {
  if (!providerId || !modelId) return send({ type: 'error', errorText: 'No model selected' })

  let ctx
  try {
    ctx = await session.prepareSend(dir, { sessionId, inputMessages, promptRef, providerId, modelId })
  } catch (e) {
    return send({ type: 'error', errorText: e.message })
  }

  if (ctx.fileReplacement) sessionState.patch({ sessionId, replaceFiles: ctx.fileReplacement })
  sessionState.patch({ sessionId, branches: ctx.branches })
  await sessions.push()

  ctx.afterSend()
    .then(async (changed) => { if (changed) await sessions.push() })
    .catch(() => {})

  let result
  try {
    result = await ctx.stream(send, signal)
  } catch (e) {
    return send({ type: 'error', errorText: e.message })
  }
  if (!result) return

  const branches = await ctx.finalize(result)
  await sessions.push()
  sessionState.patch({ sessionId, branches })
})
