import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const arcfsDir = path.join(os.tmpdir(), `arc-tools-test-${process.pid}-${Date.now()}`)

vi.mock('../arcfs.js', () => ({
  resolve: (...segs) => path.join(arcfsDir, ...segs),
  fromUrl: (url) => {
    const parsed = new URL(url)
    const segments = [parsed.hostname, ...parsed.pathname.slice(1).split('/').filter(Boolean)]
    return path.join(arcfsDir, ...segments)
  },
  readJson: async (fp) => {
    try { return JSON.parse(await fs.readFile(fp, 'utf-8')) }
    catch { return null }
  },
  writeJson: async (fp, data) => {
    await fs.mkdir(path.dirname(fp), { recursive: true })
    await fs.writeFile(fp, JSON.stringify(data))
  },
}))

vi.mock('./skill.js', () => ({
  loadSkillContent: vi.fn(),
}))

const { add, _reset } = await import('./workspace.js')
const { buildTools } = await import('./tools.js')

const { read } = buildTools({ skills: [] })

const filesDir = path.join(os.tmpdir(), `arc-tools-files-${process.pid}-${Date.now()}`)

beforeEach(async () => {
  await fs.rm(path.join(arcfsDir, 'workspace.json'), { force: true })
  _reset()
})

afterAll(async () => {
  await fs.rm(arcfsDir, { recursive: true, force: true })
  await fs.rm(filesDir, { recursive: true, force: true })
})

describe('read tool access control', () => {
  test('denies non-whitelisted path', async () => {
    const fp = path.join(filesDir, 'secret.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'secret')

    const result = await read.execute({ path: fp })
    expect(result).toBe('Access denied: not in workspace')
  })

  test('allows arcfs:// paths without whitelist check', async () => {
    const dir = path.join(arcfsDir, 'tmp')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'note.txt'), 'hello from arcfs')

    const result = await read.execute({ path: 'arcfs://tmp/note.txt' })
    expect(result.content).toContain('hello from arcfs')
  })

  test('allows whitelisted path', async () => {
    const fp = path.join(filesDir, 'allowed.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'allowed content')
    await add(fp)

    const result = await read.execute({ path: fp })
    expect(result.content).toContain('allowed content')
  })
})
