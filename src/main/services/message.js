import fs from 'node:fs/promises'
import path from 'node:path'
import { generateId } from 'ai'
import { readJsonl, appendJsonl, toUrl, fromUrl } from '../arcfs.js'

export const messagesPath = (dir, sessionId) =>
  path.join(dir, sessionId, 'messages.jsonl')

export const writeTempFile = async (tmpDir, filename, data) => {
  const dest = path.join(tmpDir, filename)
  await fs.writeFile(dest, Buffer.from(data))
  return dest
}

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

export const uploadAttachment = async (tmpDir, { data, path: filePath, filename, mediaType }) => {
  await fs.mkdir(tmpDir, { recursive: true })
  const id = generateId()
  const ext = path.extname(filename)
  const name = `${id}${ext}`
  const dest = path.join(tmpDir, name)

  if (filePath) {
    await fs.copyFile(filePath, dest)
  } else {
    await fs.writeFile(dest, Buffer.from(data))
  }

  return { url: toUrl('tmp', name), filename, mediaType }
}

export const extractFiles = async (sessionDir, messages, attachments) => {
  if (!attachments?.length) return messages

  const filesDir = path.join(sessionDir, 'files')
  await fs.mkdir(filesDir, { recursive: true })

  const sessionId = path.basename(sessionDir)
  const fileParts = []

  for (const att of attachments) {
    if (att.url?.startsWith('arcfs://')) {
      const srcPath = fromUrl(att.url)
      if (srcPath.startsWith(filesDir)) {
        fileParts.push({ type: 'file', url: att.url, filename: att.filename, mediaType: att.mediaType })
        continue
      }
      const id = generateId()
      const name = `${id}${path.extname(att.filename)}`
      await fs.rename(srcPath, path.join(filesDir, name))
      fileParts.push({ type: 'file', url: toUrl('sessions', sessionId, 'files', name), filename: att.filename, mediaType: att.mediaType })
    } else {
      const id = generateId()
      const name = `${id}${path.extname(att.filename)}`
      if (att.path) {
        await fs.copyFile(att.path, path.join(filesDir, name))
      } else if (att.data) {
        await fs.writeFile(path.join(filesDir, name), Buffer.from(att.data))
      }
      fileParts.push({ type: 'file', url: toUrl('sessions', sessionId, 'files', name), filename: att.filename, mediaType: att.mediaType })
    }
  }

  const result = messages.map(m => ({ ...m }))
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role === 'user') {
      result[i] = {
        ...result[i],
        parts: [
          ...result[i].parts.filter(p => p.type !== 'file'),
          ...fileParts,
        ],
      }
      break
    }
  }

  return result
}

export const resolveArcfsUrls = async (messages) => {
  const resolved = []
  for (const msg of messages) {
    const parts = await Promise.all(msg.parts.map(async (p) => {
      if (p.type !== 'file' || !p.url?.startsWith('arcfs://')) return p
      const buf = await fs.readFile(fromUrl(p.url))
      return { ...p, url: buf.toString('base64') }
    }))
    resolved.push({ ...msg, parts })
  }
  return resolved
}

export const persistNewMessages = async (filePath, messages) => {
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

  return lastId
}

export const persistAssistantMessage = async (filePath, { assistantId, text, reasoning, toolParts = [], lastId, arcProviderId, arcModelId }) => {
  await appendJsonl(filePath, {
    id: assistantId,
    role: 'assistant',
    parts: [...toolParts, ...reasoning, { type: 'text', text }],
    arcParentId: lastId,
    arcProviderId,
    arcModelId,
  })
}
