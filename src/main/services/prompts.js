import fs from 'node:fs/promises'
import path from 'node:path'
import { readMarkdown, writeMarkdown } from '../arcfs.js'
import { resolveDir, appPath } from './profile.js'

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

const resolvePrompt = async (name) => {
  const prompts = await resolveDir('prompts', listPrompts)
  return prompts.find(p => p.name === name)?.content ?? null
}

export const promptsAppDir = appPath('prompts')

export const resolveProfilePrompts = () => resolveDir('prompts', listPrompts)

export const resolveSessionPrompt = async (dir, sessionId, meta) => {
  const local = await readMarkdown(path.join(dir, sessionId, 'prompt.md'))
  if (local) return local
  if (!meta?.promptRef) return null
  return resolvePrompt(meta.promptRef)
}

export const saveSessionPrompt = async (dir, sessionId, content) => {
  await writeMarkdown(path.join(dir, sessionId, 'prompt.md'), content)
}

export const removePrompt = async (dir, name) => {
  await fs.unlink(path.join(dir, `${name}.md`)).catch(e => {
    if (e.code !== 'ENOENT') throw e
  })
  return listPrompts(dir)
}
