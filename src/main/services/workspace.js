import fs from 'node:fs/promises'
import path from 'node:path'
import { resolve, readJson, writeJson } from '../arcfs.js'

const filePath = resolve('workspace.json')

let queue = null
const getEntries = () => (queue ??= readJson(filePath).then(d => Array.isArray(d) ? d : []))

const covers = (entry, target) =>
  entry.endsWith('/') ? target.startsWith(entry) : entry === target

/** All writes must go through mutate() to serialize and prevent lost updates. */
const mutate = (fn) => {
  queue = getEntries().then(fn)
  return queue
}

export const add = (rawPath) => mutate(async (entries) => {
  const resolved = path.resolve(rawPath)
  let entry = resolved
  try {
    const stat = await fs.stat(resolved)
    if (stat.isDirectory() && !resolved.endsWith('/')) entry = resolved + '/'
  } catch {}

  if (entries.some(e => covers(e, entry))) return entries
  const next = entries.filter(e => !covers(entry, e))
  next.push(entry)
  await writeJson(filePath, next)
  return next
})

export const remove = (rawPath) => mutate(async (entries) => {
  const resolved = path.resolve(rawPath)
  const next = entries.filter(e => e !== resolved && e !== resolved + '/')
  await writeJson(filePath, next)
  return next
})

export const list = () => getEntries()

export const isAllowed = async (rawPath) => {
  const entries = await getEntries()
  const resolved = path.resolve(rawPath)
  return entries.some(e => covers(e, resolved))
}
