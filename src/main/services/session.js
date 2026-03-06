import fs from 'node:fs/promises'
import path from 'node:path'
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

const deriveSession = async (dir, sourceId, { titleFn, messageFn, fileFn }) => {
  const meta = await readJson(path.join(dir, sourceId, 'meta.json'))
  if (!meta) return null
  const newId = sessionId()
  const srcDir = path.join(dir, sourceId)
  const destDir = path.join(dir, newId)
  await writeJson(
    path.join(destDir, 'meta.json'),
    { ...meta, title: titleFn(meta.title), createdAt: new Date().toISOString() },
  )
  await fs.copyFile(path.join(srcDir, 'prompt.md'), path.join(destDir, 'prompt.md')).catch(ignore('ENOENT'))
  await Promise.all([messageFn(srcDir, destDir), fileFn(srcDir, destDir)])
  return newId
}

export const duplicateSession = (dir, id) =>
  deriveSession(dir, id, {
    titleFn: (title) => `${title} (copy)`,
    messageFn: (src, dest) =>
      fs.copyFile(path.join(src, 'messages.jsonl'), path.join(dest, 'messages.jsonl')).catch(ignore('ENOENT')),
    fileFn: (src, dest) =>
      fs.cp(path.join(src, 'files'), path.join(dest, 'files'), { recursive: true }).catch(ignore('ENOENT')),
  })

export const forkSession = (dir, sourceId, messageId) =>
  deriveSession(dir, sourceId, {
    titleFn: (title) => `${title} (fork)`,
    messageFn: async (src, dest) => {
      const rows = await readJsonl(path.join(src, 'messages.jsonl'))
      const byId = new Map(rows.map(r => [r.id, r]))
      const msg = byId.get(messageId)
      if (!msg) throw new Error(`Message ${messageId} not found`)
      const chain = []
      let cur = msg
      while (cur) {
        chain.push(cur)
        cur = cur.arcParentId ? byId.get(cur.arcParentId) : null
      }
      chain.reverse()
      await appendJsonl(path.join(dest, 'messages.jsonl'), ...chain)
    },
    fileFn: (src, dest) =>
      fs.cp(path.join(src, 'files'), path.join(dest, 'files'), { recursive: true }).catch(ignore('ENOENT')),
  })

export const deleteSession = async (dir, id) => {
  await fs.rm(path.join(dir, id), { recursive: true, force: true })
  const layout = await readLayout(dir) ?? { pinned: [] }
  if (layout.pinned.includes(id)) {
    await writeLayout(dir, { ...layout, pinned: layout.pinned.filter(p => p !== id) })
  }
}

const promptPath = (dir, sessionId) =>
  path.join(dir, sessionId, 'prompt.md')

export const ensureMeta = async (dir, sessionId, promptRef, title = 'New Chat') => {
  const metaPath = path.join(dir, sessionId, 'meta.json')
  const existing = await readJson(metaPath)
  if (existing) return false
  await writeJson(metaPath, {
    title,
    createdAt: new Date().toISOString(),
    ...(promptRef && { promptRef }),
  })
  return true
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
