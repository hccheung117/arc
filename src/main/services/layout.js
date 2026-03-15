import path from 'node:path'
import { readJson, writeJson } from '../arcfs.js'

const readLayout = (dir) => readJson(path.join(dir, 'layout.json'))
const writeLayout = (dir, layout) => writeJson(path.join(dir, 'layout.json'), layout)

export const loadLayout = async (dir) => ({ pinned: [], folders: [], ...await readLayout(dir) })
export const findFolder = (layout, sessionId) => layout.folders.findIndex(f => f.sessions.includes(sessionId))

const removeFromAnyFolder = (layout, sessionId) => {
  const idx = findFolder(layout, sessionId)
  return idx === -1 ? layout.folders
    : layout.folders.map((f, i) => i === idx ? { ...f, sessions: f.sessions.filter(s => s !== sessionId) } : f)
}

export const cleanupSession = async (dir, id) => {
  const layout = await loadLayout(dir)
  const folderIdx = findFolder(layout, id)
  const pinned = layout.pinned.filter(p => p !== id)
  const folders = folderIdx === -1 ? layout.folders
    : layout.folders.map((f, i) => i === folderIdx ? { ...f, sessions: f.sessions.filter(s => s !== id) } : f)
  if (pinned.length !== layout.pinned.length || folderIdx !== -1) {
    await writeLayout(dir, { ...layout, pinned, folders })
  }
}

export const pinSession = async (dir, id) => {
  const layout = await loadLayout(dir)
  const pinned = layout.pinned.includes(id)
    ? layout.pinned.filter(p => p !== id)
    : [...layout.pinned, id]
  await writeLayout(dir, { ...layout, pinned })
}

export const listFolders = async (dir) => (await loadLayout(dir)).folders

export const createFolder = async (dir, name, sessionId) => {
  const layout = await loadLayout(dir)
  const folders = [...removeFromAnyFolder(layout, sessionId), { name, sessions: [sessionId], collapsed: false }]
  const pinned = layout.pinned.filter(p => p !== sessionId)
  await writeLayout(dir, { ...layout, pinned, folders })
}

export const moveToFolder = async (dir, sessionId, folderIndex) => {
  const layout = await loadLayout(dir)
  const folders = removeFromAnyFolder(layout, sessionId)
    .map((f, i) => i === folderIndex ? { ...f, sessions: [...f.sessions, sessionId] } : f)
  const pinned = layout.pinned.filter(p => p !== sessionId)
  await writeLayout(dir, { ...layout, pinned, folders })
}

export const removeFromFolder = async (dir, sessionId) => {
  const layout = await loadLayout(dir)
  const folders = removeFromAnyFolder(layout, sessionId)
  await writeLayout(dir, { ...layout, folders })
}

export const renameFolder = async (dir, folderIndex, name) => {
  const layout = await loadLayout(dir)
  const folders = layout.folders.map((f, i) => i === folderIndex ? { ...f, name } : f)
  await writeLayout(dir, { ...layout, folders })
}

export const deleteFolder = async (dir, folderIndex) => {
  const layout = await loadLayout(dir)
  const folders = layout.folders.filter((_, i) => i !== folderIndex)
  await writeLayout(dir, { ...layout, folders })
}

export const toggleFolderCollapse = async (dir, folderIndex) => {
  const layout = await loadLayout(dir)
  const folders = layout.folders.map((f, i) => i === folderIndex ? { ...f, collapsed: !f.collapsed } : f)
  await writeLayout(dir, { ...layout, folders })
}
