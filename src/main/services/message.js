import path from 'node:path'
import { generateId } from 'ai'
import { readJsonl, appendJsonl } from '../arcfs.js'

export const messagesPath = (dir, sessionId) =>
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

export const persistAssistantMessage = async (filePath, { assistantId, text, reasoning, lastId }) => {
  await appendJsonl(filePath, {
    id: assistantId,
    role: 'assistant',
    parts: [...reasoning, { type: 'text', text }],
    arcParentId: lastId,
  })
}
