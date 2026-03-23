import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generateId } from 'ai'
import mime from 'mime'
import { readJsonl, appendJsonl, toUrl, fromUrl } from '../arcfs.js'
import { extractFileRefs, quotePath } from '../../shared/text-patterns.js'
import { renderWorkspaceFiles } from '../prompts/augment.jsx'
import * as workspace from './workspace.js'

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
  return stripSyntheticParts(messages)
    .map(m => {
      const role = m.role.charAt(0).toUpperCase() + m.role.slice(1)
      const text = m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n\n')
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

const expandTilde = (p) => p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p

export const resolveFileMentions = async (sessionDir, messages) => {
  const lastUserText = messages.findLast(m => m.role === 'user')?.parts?.find(p => p.type === 'text')?.text
  if (!lastUserText) return messages

  const refs = extractFileRefs(lastUserText)
  if (!refs.length) return messages

  const filesDir = path.join(sessionDir, 'files')
  const sessionId = path.basename(sessionDir)
  const fileParts = []
  const referencePaths = []
  const urlMap = new Map()
  const seen = new Set()

  for (const ref of refs) {
    const raw = ref.path
    const resolved = raw.startsWith('arcfs://') ? raw : path.resolve(expandTilde(raw))
    if (seen.has(resolved)) continue
    seen.add(resolved)

    try {
      if (raw.startsWith('arcfs://')) {
        // Move strategy: arcfs temp files → session files
        const srcPath = fromUrl(raw)
        if (srcPath.startsWith(filesDir)) {
          const ext = path.extname(srcPath)
          const mediaType = mime.getType(ext) ?? 'application/octet-stream'
          fileParts.push({ type: 'file', url: raw, filename: path.basename(srcPath), mediaType })
          continue
        }
        await fs.mkdir(filesDir, { recursive: true })
        const ext = path.extname(srcPath)
        const name = `${generateId()}${ext}`
        await fs.rename(srcPath, path.join(filesDir, name))
        const mediaType = mime.getType(ext) ?? 'application/octet-stream'
        const newUrl = toUrl('sessions', sessionId, 'files', name)
        fileParts.push({ type: 'file', url: newUrl, filename: path.basename(srcPath), mediaType })
        urlMap.set(raw, newUrl)
      } else {
        const mediaType = mime.getType(resolved)
        if (mediaType?.startsWith('image/')) {
          // Copy strategy: local images → session files
          await fs.mkdir(filesDir, { recursive: true })
          const ext = path.extname(resolved)
          const name = `${generateId()}${ext}`
          await fs.copyFile(resolved, path.join(filesDir, name))
          const newUrl = toUrl('sessions', sessionId, 'files', name)
          fileParts.push({ type: 'file', url: newUrl, filename: path.basename(resolved), mediaType })
          urlMap.set(raw, newUrl)
        } else {
          // Reference strategy: local non-images → workspace access + XML
          await workspace.add(resolved)
          referencePaths.push(resolved)
        }
      }
    } catch (e) {
      console.warn(`[resolveFileMentions] Skipping ${raw}:`, e.message)
    }
  }

  if (urlMap.size) {
    let text = lastUserText
    for (const ref of [...refs].sort((a, b) => b.end - a.end)) {
      const newUrl = urlMap.get(ref.path)
      if (newUrl) text = text.slice(0, ref.start) + '@' + quotePath(newUrl) + text.slice(ref.end)
    }
    messages.findLast(m => m.role === 'user').parts.find(p => p.type === 'text').text = text
  }

  let result = messages
  if (fileParts.length) {
    result = augmentUserMessage(result, fileParts, { prepend: true })
  }
  if (referencePaths.length) {
    const xml = renderWorkspaceFiles(referencePaths)
    result = augmentUserMessage(result, [{ type: 'text', text: xml, arcSynthetic: true }])
  }
  return result
}

export const augmentUserMessage = (messages, parts, { prepend } = {}) => {
  if (!parts.length) return messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue
    return messages.map((m, j) => j !== i ? m : {
      ...m,
      parts: prepend ? [...parts, ...m.parts] : [...m.parts, ...parts],
    })
  }
  return messages
}

export const stripSyntheticParts = (messages) =>
  messages.map(m => {
    const filtered = m.parts.filter(p => !p.arcSynthetic)
    return filtered.length === m.parts.length ? m : { ...m, parts: filtered }
  })

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

export const persistAssistantMessage = async (filePath, { assistantId, parts, lastId, arcProviderId, arcModelId }) => {
  await appendJsonl(filePath, {
    id: assistantId,
    role: 'assistant',
    parts,
    arcParentId: lastId,
    arcProviderId,
    arcModelId,
  })
}
