import fs from 'node:fs/promises'
import { dialog, Menu } from 'electron'
import { register, registerStream, push, getMainWindow } from '../router.js'
import { defineChannel } from '../channel.js'
import { resolve } from '../arcfs.js'
import * as session from '../services/session.js'
import * as message from '../services/message.js'
import * as llm from '../services/llm.js'
import { getProvider } from '../services/provider.js'
import { fallbackTitle, generateTitle } from '../services/assist.js'
import { buildTools } from '../services/tools.js'
import { discoverSkills, buildSkillsPrompt } from '../services/skill.js'
import { promptsCh } from './prompts.js'

const dir = resolve('sessions')

const sessions = defineChannel('session:feed', async () => {
  const [list, folders] = await Promise.all([
    session.listSessions(dir),
    session.listFolders(dir),
  ])
  return { sessions: list, folders }
})

const sessionState = defineChannel('session:state:feed', async (sessionId) => {
  const { messages, branches } = await message.loadMessages(dir, sessionId)
  const prompt = await session.loadPrompt(dir, sessionId)
  return { sessionId, messages, branches, prompt }
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
  const folders = await session.listFolders(dir)
  const folderIdx = folders.findIndex(f => f.sessions.includes(id))
  const inFolder = folderIdx !== -1

  const moveSubmenu = [
    ...folders
      .map((f, i) => ({ label: f.name, click: sessions.mutate(() => session.moveToFolder(dir, id, i)) }))
      .filter((_, i) => i !== folderIdx),
    ...(folders.length > (inFolder ? 1 : 0) ? [{ type: 'separator' }] : []),
    { label: 'New Folder', click: async () => {
      await session.createFolder(dir, 'New Folder', id)
      await sessions.push()
      const updated = await session.listFolders(dir)
      push('session:folder-rename:start', updated.length - 1)
    } },
  ]

  Menu.buildFromTemplate([
    ...(!inFolder ? [
      { label: chat.pinned ? 'Unpin' : 'Pin', click: sessions.mutate(() => session.pinSession(dir, id)) },
      { type: 'separator' },
    ] : []),
    { label: 'Rename', click: () => push('session:rename:start', id) },
    { label: 'Duplicate', click: sessions.mutate(async () => {
      const newId = await session.duplicateSession(dir, id)
      if (inFolder && newId) await session.moveToFolder(dir, newId, folderIdx)
    }) },
    { type: 'separator' },
    ...(inFolder ? [{ label: 'Remove from Folder', click: sessions.mutate(() => session.removeFromFolder(dir, id)) }] : []),
    { label: 'Move to Folder', submenu: moveSubmenu },
    { type: 'separator' },
    { label: 'Delete', click: sessions.mutate(() => session.deleteSession(dir, id)) },
  ]).popup()
})

register('session:rename', sessions.mutate(({ id, title }) => session.renameSession(dir, id, title)))
register('session:create-folder', sessions.mutate(({ name, id }) => session.createFolder(dir, name, id)))
register('session:move-to-folder', sessions.mutate(({ id, folderIndex }) => session.moveToFolder(dir, id, folderIndex)))
register('session:remove-from-folder', sessions.mutate(({ id }) => session.removeFromFolder(dir, id)))
register('session:rename-folder', sessions.mutate(({ folderIndex, name }) => session.renameFolder(dir, folderIndex, name)))
register('session:delete-folder', sessions.mutate(({ folderIndex }) => session.deleteFolder(dir, folderIndex)))
register('session:toggle-folder-collapse', sessions.mutate(({ folderIndex }) => session.toggleFolderCollapse(dir, folderIndex)))

register('session:folder-context-menu', ({ folderIndex }) => {
  Menu.buildFromTemplate([
    { label: 'Rename', click: () => push('session:folder-rename:start', folderIndex) },
    { label: 'Delete', click: sessions.mutate(() => session.deleteFolder(dir, folderIndex)) },
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
  if (fileParts?.length) {
    sessionState.patch({ sessionId, replaceFiles: { id: userMsg.id, parts: fileParts } })
  }

  const { branches } = await message.loadMessages(dir, sessionId)
  sessionState.patch({ sessionId, branches })
  await sessions.push()

  if (isNew) {
    generateTitle(messages)
      .then(async (newTitle) => {
        if (!newTitle) return
        const current = await session.getSession(dir, sessionId)
        if (current?.title !== title) return
        await session.renameSession(dir, sessionId, newTitle)
        await sessions.push()
      })
      .catch(() => {})
  }

  const skills = await discoverSkills()
  const skillsPrompt = buildSkillsPrompt(skills)
  const fullSystem = [system, skillsPrompt].filter(Boolean).join('\n\n')
  const tools = buildTools({ skills })
  const result = await llm.stream({ provider, modelId, system: fullSystem, messages, tools, send, signal, thinking: true })
  if (!result) return

  await message.persistAssistantMessage(filePath, { ...result, lastId, arcProviderId: providerId, arcModelId: modelId })
  await sessions.push()
  const updated = await message.loadMessages(dir, sessionId)
  sessionState.patch({ sessionId, branches: updated.branches })
})
