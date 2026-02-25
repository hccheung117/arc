import fs from 'node:fs/promises'
import path from 'node:path'
import { readMarkdown, writeMarkdown } from '../arcfs.js'

export const listPrompts = async (dir) => {
  const entries = await fs.readdir(dir).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })

  const mdFiles = entries.filter(f => f.endsWith('.md')).sort()

  return Promise.all(mdFiles.map(async (file) => ({
    name: path.basename(file, '.md'),
    content: await readMarkdown(path.join(dir, file)),
  })))
}

export const savePrompt = async (dir, name, content) => {
  await writeMarkdown(path.join(dir, `${name}.md`), content)
  return listPrompts(dir)
}

export const removePrompt = async (dir, name) => {
  await fs.unlink(path.join(dir, `${name}.md`)).catch(e => {
    if (e.code !== 'ENOENT') throw e
  })
  return listPrompts(dir)
}
