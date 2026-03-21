import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const arcfsDir = path.join(os.tmpdir(), `arc-ws-test-${process.pid}-${Date.now()}`)

vi.mock('../arcfs.js', () => ({
  resolve: (...segs) => path.join(arcfsDir, ...segs),
  readJson: async (fp) => {
    try { return JSON.parse(await fs.readFile(fp, 'utf-8')) }
    catch { return null }
  },
  writeJson: async (fp, data) => {
    await fs.mkdir(path.dirname(fp), { recursive: true })
    await fs.writeFile(fp, JSON.stringify(data))
  },
}))

const { add, remove, list, isAllowed, _reset } = await import('./workspace.js')

// Real temp dir for test files/dirs (so fs.stat works in add())
const filesDir = path.join(os.tmpdir(), `arc-ws-files-${process.pid}-${Date.now()}`)

beforeEach(async () => {
  await fs.rm(path.join(arcfsDir, 'workspace.json'), { force: true })
  _reset()
})

afterAll(async () => {
  await fs.rm(arcfsDir, { recursive: true, force: true })
  await fs.rm(filesDir, { recursive: true, force: true })
})

// --- Helpers ---

const createFile = async (name) => {
  const fp = path.join(filesDir, name)
  await fs.mkdir(path.dirname(fp), { recursive: true })
  await fs.writeFile(fp, 'test')
  return fp
}

const createDir = async (name) => {
  const dp = path.join(filesDir, name)
  await fs.mkdir(dp, { recursive: true })
  return dp
}

// --- Group 1: Whitelist Core ---

describe('whitelist core', () => {
  test('add + isAllowed round-trip', async () => {
    const fp = await createFile('a.txt')
    await add(fp)
    expect(await isAllowed(fp)).toBe(true)
  })

  test('add appends trailing / for directories', async () => {
    const dp = await createDir('mydir')
    await add(dp)
    const entries = await list()
    expect(entries).toEqual([dp + '/'])
  })

  test('directory entry covers child paths', async () => {
    const dp = await createDir('parent')
    await add(dp)
    expect(await isAllowed(path.join(dp, 'child.txt'))).toBe(true)
    expect(await isAllowed(path.join(dp, 'sub', 'deep.js'))).toBe(true)
  })

  test('add parent subsumes existing child entries', async () => {
    const dp = await createDir('proj')
    const fa = await createFile('proj/a.txt')
    const fb = await createFile('proj/b.txt')
    await add(fa)
    await add(fb)
    expect(await list()).toHaveLength(2)

    await add(dp)
    const entries = await list()
    expect(entries).toEqual([dp + '/'])
  })

  test('add child is no-op when parent dir already exists', async () => {
    const dp = await createDir('covered')
    await add(dp)
    const child = await createFile('covered/c.txt')
    await add(child)
    const entries = await list()
    expect(entries).toEqual([dp + '/'])
  })

  test('remove revokes access', async () => {
    const fp = await createFile('removeme.txt')
    await add(fp)
    expect(await isAllowed(fp)).toBe(true)
    await remove(fp)
    expect(await isAllowed(fp)).toBe(false)
  })

  test('isAllowed returns false for unknown paths', async () => {
    expect(await isAllowed('/some/random/path')).toBe(false)
  })

  test('directory entry does not cover sibling with shared prefix', async () => {
    const dp = await createDir('ab')
    await add(dp)
    // /tmp/.../abc should NOT be covered by /tmp/.../ab/
    expect(await isAllowed(dp + 'c')).toBe(false)
  })
})

// --- Group 2: Concurrent Mutations ---

describe('concurrent mutations', () => {
  test('parallel add calls preserve all entries', async () => {
    const files = await Promise.all(
      ['r1.txt', 'r2.txt', 'r3.txt'].map(n => createFile(n)),
    )
    await Promise.all(files.map(f => add(f)))
    const entries = await list()
    expect(entries).toHaveLength(3)
    for (const f of files) expect(entries).toContain(f)
  })
})
