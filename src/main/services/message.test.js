import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const arcfsDir = path.join(os.tmpdir(), `arc-msg-test-${process.pid}-${Date.now()}`)

vi.mock('../arcfs.js', () => ({
  resolve: (...segs) => path.join(arcfsDir, ...segs),
  toUrl: (...segs) => `arcfs://${segs.join('/')}`,
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
  readJsonl: async () => [],
  appendJsonl: async () => {},
}))

const workspaceAddSpy = vi.fn()

vi.mock('./workspace.js', () => ({
  add: (...args) => workspaceAddSpy(...args),
  remove: vi.fn(),
  list: vi.fn(async () => []),
  isAllowed: vi.fn(async () => false),
  _reset: vi.fn(),
}))

const { resolveFileMentions } = await import('./message.js')

const filesDir = path.join(os.tmpdir(), `arc-msg-files-${process.pid}-${Date.now()}`)

const makeMessages = (text) => [{
  id: 'u1',
  role: 'user',
  parts: [{ type: 'text', text }],
}]

beforeEach(() => {
  workspaceAddSpy.mockClear()
})

afterAll(async () => {
  await fs.rm(arcfsDir, { recursive: true, force: true })
  await fs.rm(filesDir, { recursive: true, force: true })
})

describe('resolveFileMentions', () => {
  const sessionDir = path.join(arcfsDir, 'sessions', 'test-session')

  test('reference strategy: local non-image → workspace.add + XML', async () => {
    const fp = path.join(filesDir, 'code.js')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'console.log("hi")')

    const result = await resolveFileMentions(sessionDir, makeMessages(`check @${fp}`))
    expect(workspaceAddSpy).toHaveBeenCalledWith(fp)

    const lastUser = result.findLast(m => m.role === 'user')
    const syntheticPart = lastUser.parts.find(p => p.arcSynthetic)
    expect(syntheticPart.text).toContain('<global_workspace_files>')
    expect(syntheticPart.text).toContain(fp)
  })

  test('copy strategy: local image → copied to session files, original untouched', async () => {
    const fp = path.join(filesDir, 'photo.jpg')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'fake-image-data')

    const result = await resolveFileMentions(sessionDir, makeMessages(`look @${fp}`))

    // Original still exists
    await expect(fs.access(fp)).resolves.toBeUndefined()

    // File part added with session URL
    const lastUser = result.findLast(m => m.role === 'user')
    const filePart = lastUser.parts.find(p => p.type === 'file')
    expect(filePart).toBeTruthy()
    expect(filePart.url).toMatch(/^arcfs:\/\/sessions\/test-session\/files\//)
    expect(filePart.mediaType).toBe('image/jpeg')

    // workspace.add NOT called for images (they use copy strategy)
    expect(workspaceAddSpy).not.toHaveBeenCalled()
  })

  test('move strategy: arcfs temp → moved to session files', async () => {
    const tmpDir = path.join(arcfsDir, 'tmp')
    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'blob.png'), 'png-data')

    const result = await resolveFileMentions(sessionDir, makeMessages('see @arcfs://tmp/blob.png'))

    // Original moved (no longer at tmp)
    await expect(fs.access(path.join(tmpDir, 'blob.png'))).rejects.toThrow()

    // File part added
    const lastUser = result.findLast(m => m.role === 'user')
    const filePart = lastUser.parts.find(p => p.type === 'file')
    expect(filePart).toBeTruthy()
    expect(filePart.url).toMatch(/^arcfs:\/\/sessions\/test-session\/files\//)
  })

  test('move strategy updates text: tmp path replaced with session URL', async () => {
    const tmpDir = path.join(arcfsDir, 'tmp')
    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'img.png'), 'png-data')

    const result = await resolveFileMentions(sessionDir, makeMessages('check @arcfs://tmp/img.png please'))
    const text = result.findLast(m => m.role === 'user').parts.find(p => p.type === 'text').text
    expect(text).not.toContain('arcfs://tmp/')
    expect(text).toMatch(/check @arcfs:\/\/sessions\/test-session\/files\/\S+\.png please/)
  })

  test('copy strategy updates text: local image path replaced with session URL', async () => {
    const fp = path.join(filesDir, 'pic.jpg')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'jpeg-data')

    const result = await resolveFileMentions(sessionDir, makeMessages(`look @${fp}`))
    const text = result.findLast(m => m.role === 'user').parts.find(p => p.type === 'text').text
    expect(text).not.toContain(fp)
    expect(text).toMatch(/look @arcfs:\/\/sessions\/test-session\/files\/\S+\.jpg/)
  })

  test('multiple replacements: two tmp files both replaced', async () => {
    const tmpDir = path.join(arcfsDir, 'tmp')
    await fs.mkdir(tmpDir, { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'a.png'), 'a')
    await fs.writeFile(path.join(tmpDir, 'b.png'), 'b')

    const result = await resolveFileMentions(sessionDir, makeMessages('see @arcfs://tmp/a.png and @arcfs://tmp/b.png'))
    const text = result.findLast(m => m.role === 'user').parts.find(p => p.type === 'text').text
    expect(text).not.toContain('arcfs://tmp/')
    expect(text).toMatch(/see @arcfs:\/\/sessions\/.*\.png and @arcfs:\/\/sessions\/.*\.png/)
  })

  test('reference strategy: text unchanged for non-image files', async () => {
    const fp = path.join(filesDir, 'data.json')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, '{}')

    const result = await resolveFileMentions(sessionDir, makeMessages(`read @${fp}`))
    const text = result.findLast(m => m.role === 'user').parts.find(p => p.type === 'text').text
    expect(text).toBe(`read @${fp}`)
  })

  test('dedup: same file mentioned twice → single workspace entry', async () => {
    const fp = path.join(filesDir, 'dup.js')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'code')

    const result = await resolveFileMentions(sessionDir, makeMessages(`@${fp} and @${fp}`))
    expect(workspaceAddSpy).toHaveBeenCalledTimes(1)

    const lastUser = result.findLast(m => m.role === 'user')
    const syntheticPart = lastUser.parts.find(p => p.arcSynthetic)
    const pathOccurrences = syntheticPart.text.split(fp).length - 1
    expect(pathOccurrences).toBe(1)
  })
})
