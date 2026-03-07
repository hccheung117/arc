import fs from 'node:fs/promises'
import { dialog, Menu } from 'electron'
import { register, registerStream, push, getMainWindow } from '../router.js'
import { resolve } from '../arcfs.js'
import * as session from '../services/session.js'
import * as message from '../services/message.js'
import * as llm from '../services/llm.js'
import { getProvider } from '../services/provider.js'
import { fallbackTitle, generateTitle } from '../services/assist.js'
import { pushPrompts } from './prompts.js'

const dir = resolve('sessions')

const pushSessions = async () => {
  const [sessions, folders] = await Promise.all([
    session.listSessions(dir),
    session.listFolders(dir),
  ])
  push('session:feed', { sessions, folders })
}

const pushSessionState = (sessionId, patch) =>
  push('session:state:feed', { sessionId, ...patch })

const forkFromMessage = async (sessionId, messageId) => {
  const newId = await session.forkSession(dir, sessionId, messageId)
  if (!newId) return
  await pushSessions()
  push('session:navigate:feed', newId)
}

export { pushSessions, pushSessionState, forkFromMessage }

register('session:list', () => session.listSessions(dir))

register('session:context-menu', async ({ id }) => {
  const chat = await session.getSession(dir, id)
  if (!chat) return
  const folders = await session.listFolders(dir)
  const folderIdx = folders.findIndex(f => f.sessions.includes(id))
  const inFolder = folderIdx !== -1

  const moveSubmenu = [
    ...folders
      .map((f, i) => ({ label: f.name, click: async () => { await session.moveToFolder(dir, id, i); pushSessions() } }))
      .filter((_, i) => i !== folderIdx),
    ...(folders.length > (inFolder ? 1 : 0) ? [{ type: 'separator' }] : []),
    { label: 'New Folder', click: async () => {
      await session.createFolder(dir, 'New Folder', id)
      await pushSessions()
      const updated = await session.listFolders(dir)
      push('session:folder-rename:start', updated.length - 1)
    } },
  ]

  Menu.buildFromTemplate([
    ...(!inFolder ? [
      { label: chat.pinned ? 'Unpin' : 'Pin', click: async () => { await session.pinSession(dir, id); pushSessions() } },
      { type: 'separator' },
    ] : []),
    { label: 'Rename', click: () => push('session:rename:start', id) },
    { label: 'Duplicate', click: async () => {
      const newId = await session.duplicateSession(dir, id)
      if (inFolder && newId) await session.moveToFolder(dir, newId, folderIdx)
      pushSessions()
    } },
    { type: 'separator' },
    ...(inFolder ? [{ label: 'Remove from Folder', click: async () => { await session.removeFromFolder(dir, id); pushSessions() } }] : []),
    { label: 'Move to Folder', submenu: moveSubmenu },
    { type: 'separator' },
    { label: 'Delete', click: async () => { await session.deleteSession(dir, id); pushSessions() } },
  ]).popup()
})

register('session:rename', async ({ id, title }) => {
  await session.renameSession(dir, id, title)
  await pushSessions()
})

register('session:create-folder', async ({ name, id }) => { await session.createFolder(dir, name, id); pushSessions() })
register('session:move-to-folder', async ({ id, folderIndex }) => { await session.moveToFolder(dir, id, folderIndex); pushSessions() })
register('session:remove-from-folder', async ({ id }) => { await session.removeFromFolder(dir, id); pushSessions() })
register('session:rename-folder', async ({ folderIndex, name }) => { await session.renameFolder(dir, folderIndex, name); pushSessions() })
register('session:delete-folder', async ({ folderIndex }) => { await session.deleteFolder(dir, folderIndex); pushSessions() })
register('session:toggle-folder-collapse', async ({ folderIndex }) => { await session.toggleFolderCollapse(dir, folderIndex); pushSessions() })

register('session:folder-context-menu', ({ folderIndex }) => {
  Menu.buildFromTemplate([
    { label: 'Rename', click: () => push('session:folder-rename:start', folderIndex) },
    { label: 'Delete', click: async () => { await session.deleteFolder(dir, folderIndex); pushSessions() } },
  ]).popup()
})

register('session:activate', async ({ sessionId }) => {
  const { messages, branches } = await message.loadMessages(dir, sessionId)
  const prompt = await session.loadPrompt(dir, sessionId)
  pushSessionState(sessionId, { messages, branches, prompt })
})

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
  pushSessionState(id, { prompt })
})

register('session:save-prompt', async ({ id, content }) => {
  const shared = await session.savePrompt(dir, id, content)
  if (shared) pushPrompts()
  const prompt = await session.loadPrompt(dir, id)
  pushSessionState(id, { prompt })
})

registerStream('session:send', async ({ sessionId, messages: inputMessages, attachments, promptRef, providerId, modelId, send, signal }) => {
  if (!providerId || !modelId) {
    send({ type: 'error', errorText: 'No model selected' })
    return
  }

  const provider = await getProvider(providerId)
  if (!provider) {
    send({ type: 'error', errorText: `Provider "${providerId}" not found` })
    return
  }

  const title = fallbackTitle(inputMessages)
  const isNew = await session.ensureMeta(dir, sessionId, promptRef, title)
  const system = await session.loadPrompt(dir, sessionId)
  const messages = await message.extractFiles(resolve('sessions', sessionId), inputMessages, attachments)
  const filePath = message.messagesPath(dir, sessionId)
  const lastId = await message.persistNewMessages(filePath, messages)

  const userMsg = messages.findLast(m => m.role === 'user')
  const fileParts = userMsg?.parts.filter(p => p.type === 'file')
  // Replace renderer's tmp attachment URLs with permanent session file URLs
  if (fileParts?.length) {
    pushSessionState(sessionId, { replaceFiles: { id: userMsg.id, parts: fileParts } })
  }

  // Persisting may have created new branch points; sync sidebar + message tree
  const { branches } = await message.loadMessages(dir, sessionId)
  pushSessionState(sessionId, { branches })
  await pushSessions()

  if (isNew) {
    generateTitle(messages)
      .then(async (newTitle) => {
        if (!newTitle) return
        const current = await session.getSession(dir, sessionId)
        if (current?.title !== title) return
        await session.renameSession(dir, sessionId, newTitle)
        // Refresh sidebar with the AI-generated title
        await pushSessions()
      })
      .catch(() => {})
  }

  const result = await llm.streamText({ provider, modelId, system, messages: messages, send, signal, thinking: true })
  if (!result) return

  await message.persistAssistantMessage(filePath, { ...result, lastId })
  // Refresh sidebar (updated timestamp) and branch tree (new assistant node)
  await pushSessions()
  const updated = await message.loadMessages(dir, sessionId)
  pushSessionState(sessionId, { branches: updated.branches })
})
