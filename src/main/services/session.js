import fs from 'node:fs/promises'
import path from 'node:path'
import { generateId } from 'ai'
import { sessionId } from '@shared/ids.js'
import { readJson, writeJson, readJsonl, appendJsonl } from '../arcfs.js'
import { resolveSessionPrompt, saveSessionPrompt, savePrompt as saveAppPrompt, promptsAppDir } from './prompts.js'

const readLayout = (dir) => readJson(path.join(dir, 'layout.json'))
const writeLayout = (dir, layout) => writeJson(path.join(dir, 'layout.json'), layout)

export const listSessions = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })

  const dirs = entries.filter(e => e.isDirectory())
  const layout = await readLayout(dir) ?? { pinned: [] }

  const sessions = await Promise.all(dirs.map(async (entry) => {
    const sessionDir = path.join(dir, entry.name)
    const meta = await readJson(path.join(sessionDir, 'meta.json'))
    if (!meta) return null

    const mtime = await fs.stat(path.join(sessionDir, 'messages.jsonl'))
      .then(s => s.mtime.toISOString())
      .catch(() => null)

    return {
      id: entry.name,
      title: meta.title,
      date: mtime ?? meta.createdAt,
      ...(layout.pinned.includes(entry.name) && { pinned: true }),
    }
  }))

  return sessions.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date))
}

export const getSession = async (dir, id) => {
  const meta = await readJson(path.join(dir, id, 'meta.json'))
  if (!meta) return null
  const layout = await readLayout(dir) ?? { pinned: [] }
  return {
    id,
    title: meta.title,
    date: meta.createdAt,
    pinned: layout.pinned.includes(id),
  }
}

export const createSession = async (dir, title = 'New Chat') => {
  const id = sessionId()
  await writeJson(
    path.join(dir, id, 'meta.json'),
    { title, createdAt: new Date().toISOString() },
  )
  return id
}

export const renameSession = async (dir, id, title) => {
  const metaPath = path.join(dir, id, 'meta.json')
  const meta = await readJson(metaPath)
  if (!meta) return
  await writeJson(metaPath, { ...meta, title })
}

export const pinSession = async (dir, id) => {
  const layout = await readLayout(dir) ?? { pinned: [] }
  const pinned = layout.pinned.includes(id)
    ? layout.pinned.filter(p => p !== id)
    : [...layout.pinned, id]
  await writeLayout(dir, { ...layout, pinned })
}

const ignore = (code) => (e) => { if (e.code !== code) throw e }

export const duplicateSession = async (dir, id) => {
  const meta = await readJson(path.join(dir, id, 'meta.json'))
  if (!meta) return
  const newId = sessionId()
  const srcDir = path.join(dir, id)
  const destDir = path.join(dir, newId)
  await writeJson(
    path.join(destDir, 'meta.json'),
    { ...meta, title: `${meta.title} (copy)`, createdAt: new Date().toISOString() },
  )
  await Promise.all([
    fs.copyFile(path.join(srcDir, 'messages.jsonl'), path.join(destDir, 'messages.jsonl')).catch(ignore('ENOENT')),
    fs.copyFile(path.join(srcDir, 'prompt.md'), path.join(destDir, 'prompt.md')).catch(ignore('ENOENT')),
    fs.cp(path.join(srcDir, 'files'), path.join(destDir, 'files'), { recursive: true }).catch(ignore('ENOENT')),
  ])
}

export const deleteSession = async (dir, id) => {
  await fs.rm(path.join(dir, id), { recursive: true, force: true })
  const layout = await readLayout(dir) ?? { pinned: [] }
  if (layout.pinned.includes(id)) {
    await writeLayout(dir, { ...layout, pinned: layout.pinned.filter(p => p !== id) })
  }
}

const promptPath = (dir, sessionId) =>
  path.join(dir, sessionId, 'prompt.md')

const messagesPath = (dir, sessionId) =>
  path.join(dir, sessionId, 'messages.jsonl')

const buildTree = (rows) => {
  const childrenOf = new Map()
  for (const r of rows) {
    const key = r.arcParentId ?? null
    const siblings = childrenOf.get(key) ?? []
    siblings.push(r.id)
    childrenOf.set(r.arcParentId, siblings)
  }
  return childrenOf
}

const computeBranches = (childrenOf, chain) => {
  const branches = {}
  for (const row of chain) {
    const siblings = childrenOf.get(row.arcParentId ?? null)
    if (!siblings || siblings.length <= 1) continue
    branches[row.id] = {
      index: siblings.indexOf(row.id),
      total: siblings.length,
      siblings,
    }
  }
  return branches
}

const findLeaf = (id, childrenOf) => {
  while (childrenOf.has(id)) {
    const children = childrenOf.get(id)
    id = children[children.length - 1]
  }
  return id
}

export const loadMessages = async (dir, sessionId, leafId) => {
  const rows = await readJsonl(messagesPath(dir, sessionId))
  if (!rows.length) return { messages: [], branches: {} }

  const byId = new Map(rows.map(r => [r.id, r]))
  const childrenOf = buildTree(rows)

  const start = leafId ? byId.get(leafId) : rows[rows.length - 1]
  const chain = []
  let cur = start
  while (cur) {
    chain.push(cur)
    cur = cur.arcParentId ? byId.get(cur.arcParentId) : null
  }
  chain.reverse()

  return {
    messages: chain.map(({ arcParentId, ...msg }) => msg),
    branches: computeBranches(childrenOf, chain),
  }
}

export const switchBranch = async (dir, sessionId, targetId) => {
  const rows = await readJsonl(messagesPath(dir, sessionId))
  const childrenOf = buildTree(rows)
  const leafId = findLeaf(targetId, childrenOf)
  return loadMessages(dir, sessionId, leafId)
}

export const editMessage = async (dir, sessionId, messageId, text) => {
  const filePath = messagesPath(dir, sessionId)
  const rows = await readJsonl(filePath)
  const original = rows.find(r => r.id === messageId)
  const newId = generateId()
  await appendJsonl(filePath, {
    id: newId,
    role: original.role,
    parts: [{ type: 'text', text }, ...original.parts.filter(p => p.type !== 'text')],
    arcParentId: original.arcParentId,
  })
  return newId
}

export const exportMarkdown = async (dir, sessionId) => {
  const { messages } = await loadMessages(dir, sessionId)
  return messages
    .map(m => {
      const role = m.role.charAt(0).toUpperCase() + m.role.slice(1)
      const text = m.parts.filter(p => p.type === 'text').map(p => p.text).join('')
      return `**${role}:** ${text}`
    })
    .join('\n\n')
}

export const loadPrompt = async (dir, sessionId) => {
  const meta = await readJson(path.join(dir, sessionId, 'meta.json'))
  return resolveSessionPrompt(promptPath(dir, sessionId), meta?.promptRef)
}

export const savePrompt = async (dir, id, content) => {
  const meta = await readJson(path.join(dir, id, 'meta.json'))
  if (meta?.promptRef) {
    await saveAppPrompt(promptsAppDir, meta.promptRef, content)
    return true
  }
  await saveSessionPrompt(promptPath(dir, id), content)
  return false
}

const MOCK_RESPONSE = "Hello! I'm a mock AI assistant running locally via IPC. This response is being streamed character by character to demonstrate the streaming infrastructure. How can I help you today?"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const streamText = async (dir, sessionId, messages, send, signal, { promptRef, onPersist } = {}) => {
  const metaPath = path.join(dir, sessionId, 'meta.json')
  let meta = await readJson(metaPath)
  if (!meta) {
    meta = { title: 'New Chat', createdAt: new Date().toISOString(), ...(promptRef && { promptRef }) }
    await writeJson(metaPath, meta)
  }

  const systemPrompt = await resolveSessionPrompt(promptPath(dir, sessionId), meta?.promptRef)

  const filePath = messagesPath(dir, sessionId)
  const existing = await readJsonl(filePath)
  const knownIds = new Set(existing.map(r => r.id))

  const newMessages = messages.filter(m => !knownIds.has(m.id))
  let lastId = null
  for (let i = messages.length - 1; i >= 0; i--) {
    if (knownIds.has(messages[i].id)) { lastId = messages[i].id; break }
  }

  for (const msg of newMessages) {
    await appendJsonl(filePath, { ...msg, arcParentId: lastId })
    lastId = msg.id
  }

  await onPersist?.()

  const assistantId = generateId()
  const textId = generateId()

  send({ type: 'start', messageId: assistantId })
  send({ type: 'start-step' })
  send({ type: 'text-start', id: textId })

  let fullText = ''
  for (const char of MOCK_RESPONSE) {
    if (signal.aborted) break
    fullText += char
    await sleep(30)
    send({ type: 'text-delta', delta: char, id: textId })
  }

  send({ type: 'text-end', id: textId })
  send({ type: 'finish-step' })
  send({ type: 'finish', finishReason: signal.aborted ? 'stop' : 'end-turn' })

  await appendJsonl(filePath, {
    id: assistantId,
    role: 'assistant',
    parts: [{ type: 'text', text: fullText }],
    arcParentId: lastId,
  })
}
