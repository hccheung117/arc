import fs from 'node:fs/promises'
import path from 'node:path'
import { resolve, readJson, writeJson } from '../arcfs.js'

const filePath = resolve('workspace.json')

let loaded = null
const getEntries = () => (loaded ??= readJson(filePath).then(d => Array.isArray(d) ? d : []))

const covers = (entry, target) =>
  entry.endsWith('/') ? target.startsWith(entry) : entry === target

export const add = async (rawPath) => {
  const entries = await getEntries()
  const resolved = path.resolve(rawPath)
  let entry = resolved
  try {
    const stat = await fs.stat(resolved)
    if (stat.isDirectory() && !resolved.endsWith('/')) entry = resolved + '/'
  } catch {}

  if (entries.some(e => covers(e, entry))) return
  const next = entries.filter(e => !covers(entry, e))
  next.push(entry)
  loaded = Promise.resolve(next)
  await writeJson(filePath, next)
}

export const remove = async (rawPath) => {
  const entries = await getEntries()
  const resolved = path.resolve(rawPath)
  const next = entries.filter(e => e !== resolved && e !== resolved + '/')
  loaded = Promise.resolve(next)
  await writeJson(filePath, next)
}

export const list = async () => getEntries()

export const isAllowed = async (rawPath) => {
  const entries = await getEntries()
  const resolved = path.resolve(rawPath)
  return entries.some(e => covers(e, resolved))
}
