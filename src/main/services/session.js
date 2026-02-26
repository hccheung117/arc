import fs from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { readJson, writeJson } from '../arcfs.js'

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
  const id = nanoid()
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

export const duplicateSession = async (dir, id) => {
  const meta = await readJson(path.join(dir, id, 'meta.json'))
  if (!meta) return
  const newId = nanoid()
  await writeJson(
    path.join(dir, newId, 'meta.json'),
    { title: `${meta.title} (copy)`, createdAt: new Date().toISOString() },
  )
}

export const deleteSession = async (dir, id) => {
  await fs.rm(path.join(dir, id), { recursive: true, force: true })
  const layout = await readLayout(dir) ?? { pinned: [] }
  if (layout.pinned.includes(id)) {
    await writeLayout(dir, { ...layout, pinned: layout.pinned.filter(p => p !== id) })
  }
}

const MOCK_RESPONSE = "Hello! I'm a mock AI assistant running locally via IPC. This response is being streamed character by character to demonstrate the streaming infrastructure. How can I help you today?"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const streamText = async (send, signal) => {
  const textId = crypto.randomUUID()

  send({ type: 'start' })
  send({ type: 'start-step' })
  send({ type: 'text-start', id: textId })

  for (const char of MOCK_RESPONSE) {
    if (signal.aborted) break
    await sleep(30)
    send({ type: 'text-delta', delta: char, id: textId })
  }

  send({ type: 'text-end', id: textId })
  send({ type: 'finish-step' })
  send({ type: 'finish', finishReason: signal.aborted ? 'stop' : 'end-turn' })
}
