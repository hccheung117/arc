import fs from 'node:fs/promises'
import { dialog, Menu } from 'electron'
import { register, registerStream, push, getMainWindow } from '../router.js'
import { resolve } from '../arcfs.js'
import * as session from '../services/session.js'
import * as message from '../services/message.js'
import * as llm from '../services/llm.js'
import { getProvider } from '../services/provider.js'
import { pushPrompts } from './prompts.js'

const dir = resolve('sessions')

const pushSessions = async () =>
  push('session:listen', await session.listSessions(dir))

const pushSessionState = (sessionId, patch) =>
  push('session:state:listen', { sessionId, ...patch })

export { pushSessions, pushSessionState }

register('session:list', () => session.listSessions(dir))

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

register('session:save-prompt', async ({ id, content }) => {
  const shared = await session.savePrompt(dir, id, content)
  if (shared) pushPrompts()
  const prompt = await session.loadPrompt(dir, id)
  pushSessionState(id, { prompt })
})

registerStream('session:send', async ({ sessionId, messages, promptRef, providerId, modelId, send, signal }) => {
  if (!providerId || !modelId) {
    send({ type: 'error', errorText: 'No model selected' })
    return
  }

  const provider = await getProvider(providerId)
  if (!provider) {
    send({ type: 'error', errorText: `Provider "${providerId}" not found` })
    return
  }

  await session.ensureMeta(dir, sessionId, promptRef)
  const system = await session.loadPrompt(dir, sessionId)
  const filePath = message.messagesPath(dir, sessionId)
  const lastId = await message.persistNewMessages(filePath, messages)

  const { branches } = await message.loadMessages(dir, sessionId)
  pushSessionState(sessionId, { branches })
  await pushSessions()

  const result = await llm.streamText({ provider, modelId, system, messages, send, signal })
  if (!result) return

  await message.persistAssistantMessage(filePath, { ...result, lastId })
  await pushSessions()
  const updated = await message.loadMessages(dir, sessionId)
  pushSessionState(sessionId, { branches: updated.branches })
})
