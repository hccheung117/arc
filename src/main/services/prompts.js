import fs from 'node:fs/promises'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'

export const listPrompts = async (dir) => {
  const entries = await fs.readdir(dir).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })

  const mdFiles = entries.filter(f => f.endsWith('.md')).sort()

  return Promise.all(mdFiles.map(async (file) => ({
    name: path.basename(file, '.md'),
    content: await fs.readFile(path.join(dir, file), 'utf-8'),
  })))
}

export const savePrompt = async (dir, name, content) => {
  await fs.mkdir(dir, { recursive: true })
  await writeFileAtomic(path.join(dir, `${name}.md`), content)
  return listPrompts(dir)
}

export const removePrompt = async (dir, name) => {
  await fs.unlink(path.join(dir, `${name}.md`)).catch(e => {
    if (e.code !== 'ENOENT') throw e
  })
  return listPrompts(dir)
}
