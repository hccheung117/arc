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

const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args) => mockExecFile(...args),
}))

const { add, _reset } = await import('./workspace.js')
const { buildTools } = await import('./tools.js')

const { read_file, list_dir, write_file, edit_file } = buildTools({ skills: [] })

const filesDir = path.join(os.tmpdir(), `arc-tools-files-${process.pid}-${Date.now()}`)

beforeEach(async () => {
  await fs.rm(path.join(arcfsDir, 'workspace.json'), { force: true })
  _reset()
})

afterAll(async () => {
  await fs.rm(arcfsDir, { recursive: true, force: true })
  await fs.rm(filesDir, { recursive: true, force: true })
})

describe('read_file tool', () => {
  test('denies non-whitelisted path', async () => {
    const fp = path.join(filesDir, 'secret.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'secret')

    const result = await read_file.execute({ path: fp })
    expect(result).toBe('Access denied: not in workspace')
  })

  test('allows arcfs:// paths without whitelist check', async () => {
    const dir = path.join(arcfsDir, 'tmp')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'note.txt'), 'hello from arcfs')

    const result = await read_file.execute({ path: 'arcfs://tmp/note.txt' })
    expect(result.content).toContain('hello from arcfs')
  })

  test('allows whitelisted path', async () => {
    const fp = path.join(filesDir, 'allowed.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'allowed content')
    await add(fp)

    const result = await read_file.execute({ path: fp })
    expect(result.content).toContain('allowed content')
  })
})

describe('list_dir tool', () => {
  test('denies non-whitelisted path', async () => {
    const result = await list_dir.execute({ path: filesDir })
    expect(result).toBe('Access denied: not in workspace')
  })

  test('allows arcfs:// paths', async () => {
    const dir = path.join(arcfsDir, 'listtest')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'a.txt'), 'a')

    const result = await list_dir.execute({ path: 'arcfs://listtest' })
    expect(result).toEqual([{ name: 'a.txt', type: 'file', size: 1 }])
  })

  test('allows whitelisted path and sorts dirs first', async () => {
    const dir = path.join(filesDir, 'listed')
    await fs.mkdir(path.join(dir, 'subdir'), { recursive: true })
    await fs.writeFile(path.join(dir, 'b.txt'), 'bb')
    await fs.writeFile(path.join(dir, 'a.txt'), 'a')
    await add(dir)

    const result = await list_dir.execute({ path: dir })
    expect(result).toEqual([
      { name: 'subdir', type: 'directory' },
      { name: 'a.txt', type: 'file', size: 1 },
      { name: 'b.txt', type: 'file', size: 2 },
    ])
  })

  test('returns error for non-directory', async () => {
    const fp = path.join(filesDir, 'notadir.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'hi')
    await add(fp)

    const result = await list_dir.execute({ path: fp })
    expect(result).toContain('Not a directory')
  })
})

describe('write_file tool', () => {
  test('denies non-whitelisted path', async () => {
    const result = await write_file.execute({ path: path.join(filesDir, 'nope.txt'), content: 'x' })
    expect(result).toBe('Access denied: not in workspace')
  })

  test('creates file with auto-mkdir via arcfs', async () => {
    const result = await write_file.execute({ path: 'arcfs://writedir/new.txt', content: 'hello' })
    expect(result.bytesWritten).toBe(5)
    const written = await fs.readFile(path.join(arcfsDir, 'writedir', 'new.txt'), 'utf-8')
    expect(written).toBe('hello')
  })

  test('overwrites existing text file', async () => {
    const fp = path.join(filesDir, 'overwrite.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'old')
    await add(fp)

    const result = await write_file.execute({ path: fp, content: 'new' })
    expect(result.bytesWritten).toBe(3)
    expect(await fs.readFile(fp, 'utf-8')).toBe('new')
  })

  test('refuses to overwrite binary file', async () => {
    const fp = path.join(filesDir, 'binary.bin')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, Buffer.from([0x00, 0x01, 0x02]))
    await add(fp)

    const result = await write_file.execute({ path: fp, content: 'text' })
    expect(result).toContain('Cannot overwrite binary file')
  })
})

describe('edit_file tool', () => {
  test('denies non-whitelisted path', async () => {
    const result = await edit_file.execute({ path: path.join(filesDir, 'nope.txt'), old_string: 'a', new_string: 'b' })
    expect(result).toBe('Access denied: not in workspace')
  })

  test('replaces unique string via arcfs', async () => {
    const dir = path.join(arcfsDir, 'editdir')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'file.txt'), 'hello world')

    const result = await edit_file.execute({ path: 'arcfs://editdir/file.txt', old_string: 'hello', new_string: 'goodbye' })
    expect(result).toEqual({ path: path.join(dir, 'file.txt'), replacements: 1 })
    expect(await fs.readFile(path.join(dir, 'file.txt'), 'utf-8')).toBe('goodbye world')
  })

  test('fails when string not found', async () => {
    const fp = path.join(filesDir, 'edit-notfound.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'hello')
    await add(fp)

    const result = await edit_file.execute({ path: fp, old_string: 'missing', new_string: 'x' })
    expect(result).toContain('String not found')
  })

  test('fails on ambiguous match', async () => {
    const fp = path.join(filesDir, 'edit-ambiguous.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'aaa')
    await add(fp)

    const result = await edit_file.execute({ path: fp, old_string: 'a', new_string: 'b' })
    expect(result).toContain('appears 3 times')
  })
})

describe('exec tool', () => {
  const skillDir = path.join(arcfsDir, 'profiles', 'eascoai-test', 'skills', 'using-excel')
  const skillDirUrl = 'arcfs://profiles/eascoai-test/skills/using-excel'
  const { exec } = buildTools({ skills: [{ directory: skillDirUrl }] })

  beforeEach(async () => {
    mockExecFile.mockReset()
    mockExecFile.mockImplementation((_bin, _args, _opts, cb) => cb(null, 'ok', ''))
    await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true })
    await fs.writeFile(path.join(skillDir, 'scripts', 'xlsx.js'), '// script')
  })

  const nodeBootstrap = 'delete process.versions.electron;process.execArgv=[];require(process.argv[1])'

  test('node runner with subdirectory script and args', async () => {
    await exec.execute({
      runner: 'node',
      script: 'scripts/xlsx.js create /tmp/demo.xlsx --from /tmp/test-data.json',
      cwd: skillDirUrl,
    })
    expect(mockExecFile).toHaveBeenCalledWith(
      process.execPath,
      ['-e', nodeBootstrap, path.join(skillDir, 'scripts', 'xlsx.js'), 'create', '/tmp/demo.xlsx', '--from', '/tmp/test-data.json'],
      expect.objectContaining({
        cwd: skillDir,
        env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: '1' }),
      }),
      expect.any(Function),
    )
  })

  test('node runner with multiple arcfs:// args', async () => {
    await exec.execute({
      runner: 'node',
      script: 'scripts/xlsx.js create arcfs://sessions/abc/workspace/out.xlsx --from arcfs://sessions/abc/workspace/data.json',
      cwd: skillDirUrl,
    })
    expect(mockExecFile).toHaveBeenCalledWith(
      process.execPath,
      [
        '-e', nodeBootstrap,
        path.join(skillDir, 'scripts', 'xlsx.js'),
        'create',
        path.join(arcfsDir, 'sessions', 'abc', 'workspace', 'out.xlsx'),
        '--from',
        path.join(arcfsDir, 'sessions', 'abc', 'workspace', 'data.json'),
      ],
      expect.objectContaining({ cwd: skillDir }),
      expect.any(Function),
    )
  })

  test('freeform runner resolves from PATH', async () => {
    await exec.execute({ runner: 'python', script: 'scripts/xlsx.js', cwd: skillDirUrl })
    expect(mockExecFile).toHaveBeenCalledWith(
      'python',
      [path.join(skillDir, 'scripts', 'xlsx.js')],
      expect.objectContaining({ cwd: skillDir }),
      expect.any(Function),
    )
  })

  test('rejects script outside trusted skill directories', async () => {
    const result = await exec.execute({ runner: 'node', script: '../../../etc/passwd', cwd: skillDirUrl })
    expect(result).toBe('Script is outside trusted skill directories')
    expect(mockExecFile).not.toHaveBeenCalled()
  })
})
