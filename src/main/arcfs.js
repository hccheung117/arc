import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'

export const resolve = (...segments) =>
  path.join(app.getPath('userData'), 'arcfs', ...segments)

export const readJson = async (filepath) => {
  try { return JSON.parse(await fs.readFile(filepath, 'utf-8')) }
  catch (e) { if (e.code === 'ENOENT') return null; throw e }
}

export const writeJson = async (filepath, data) => {
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await writeFileAtomic(filepath, JSON.stringify(data))
}

export const readMarkdown = async (filepath) => {
  try { return await fs.readFile(filepath, 'utf-8') }
  catch (e) { if (e.code === 'ENOENT') return null; throw e }
}

export const writeMarkdown = async (filepath, content) => {
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await writeFileAtomic(filepath, content)
}

export const readJsonl = async (filepath) => {
  try {
    const text = await fs.readFile(filepath, 'utf-8')
    return text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  } catch (e) { if (e.code === 'ENOENT') return []; throw e }
}

export const appendJsonl = async (filepath, ...items) => {
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await fs.appendFile(filepath, items.map(item => JSON.stringify(item) + '\n').join(''))
}
