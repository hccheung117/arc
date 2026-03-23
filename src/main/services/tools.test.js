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
  skillEnvName: (name) => name.replace(/-/g, '_').toUpperCase() + '_SKILL_DIR',
}))

vi.mock('./browser.js', () => ({
  execute: vi.fn(),
  setTmpPath: vi.fn(),
}))

const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args) => mockExecFile(...args),
}))

const { add, _reset } = await import('./workspace.js')
const { buildTools, expandVars, expandArgsVars } = await import('./tools.js')

const workspacePath = path.join(arcfsDir, 'sessions', 'test', 'workspace')
const { read_file, list_dir, write_file, edit_file } = buildTools({ skills: [], workspacePath })

const filesDir = path.join(os.tmpdir(), `arc-tools-files-${process.pid}-${Date.now()}`)

beforeEach(async () => {
  await fs.rm(path.join(arcfsDir, 'workspace.json'), { force: true })
  _reset()
})

afterAll(async () => {
  await fs.rm(arcfsDir, { recursive: true, force: true })
  await fs.rm(filesDir, { recursive: true, force: true })
})

describe('expandVars', () => {
  test('expands $VAR syntax', () => {
    expect(expandVars('$WORKSPACE/file.txt', { WORKSPACE: '/tmp/ws' })).toBe('/tmp/ws/file.txt')
  })

  test('expands ${VAR} syntax', () => {
    expect(expandVars('${WORKSPACE}/file.txt', { WORKSPACE: '/tmp/ws' })).toBe('/tmp/ws/file.txt')
  })

  test('passes through unknown vars', () => {
    expect(expandVars('$UNKNOWN/file.txt', {})).toBe('$UNKNOWN/file.txt')
  })

  test('expands multiple vars in one string', () => {
    const vars = { WORKSPACE: '/ws', MY_SKILL_DIR: '/skill' }
    expect(expandVars('$WORKSPACE to $MY_SKILL_DIR', vars)).toBe('/ws to /skill')
  })
})

describe('read_file tool', () => {
  test('denies non-whitelisted path', async () => {
    const fp = path.join(filesDir, 'secret.txt')
    await fs.mkdir(filesDir, { recursive: true })
    await fs.writeFile(fp, 'secret')

    const result = await read_file.execute({ path: fp })
    expect(result).toBe('Access denied: not in workspace')
  })

  test('allows paths under arcfs root without whitelist check', async () => {
    const dir = path.join(arcfsDir, 'tmp')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'note.txt'), 'hello from arcfs')

    const result = await read_file.execute({ path: path.join(dir, 'note.txt') })
    expect(result.content).toContain('hello from arcfs')
  })

  test('expands $WORKSPACE env var', async () => {
    await fs.mkdir(workspacePath, { recursive: true })
    await fs.writeFile(path.join(workspacePath, 'note.txt'), 'workspace content')

    const result = await read_file.execute({ path: '$WORKSPACE/note.txt' })
    expect(result.content).toContain('workspace content')
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

  test('allows paths under arcfs root', async () => {
    const dir = path.join(arcfsDir, 'listtest')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'a.txt'), 'a')

    const result = await list_dir.execute({ path: dir })
    expect(result).toBe(`BASE PATH: ${dir}/\n\na.txt\t1 B`)
  })

  test('allows whitelisted path and sorts dirs first', async () => {
    const dir = path.join(filesDir, 'listed')
    await fs.mkdir(path.join(dir, 'subdir'), { recursive: true })
    await fs.writeFile(path.join(dir, 'b.txt'), 'bb')
    await fs.writeFile(path.join(dir, 'a.txt'), 'a')
    await add(dir)

    const result = await list_dir.execute({ path: dir })
    expect(result).toBe(`BASE PATH: ${dir}/\n\nsubdir/\na.txt\t1 B\nb.txt\t2 B`)
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

  test('creates file with auto-mkdir via $WORKSPACE', async () => {
    const result = await write_file.execute({ path: '$WORKSPACE/writedir/new.txt', content: 'hello' })
    expect(result.bytesWritten).toBe(5)
    const written = await fs.readFile(path.join(workspacePath, 'writedir', 'new.txt'), 'utf-8')
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

  test('replaces unique string via arcfs root path', async () => {
    const dir = path.join(arcfsDir, 'editdir')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'file.txt'), 'hello world')

    const result = await edit_file.execute({ path: path.join(dir, 'file.txt'), old_string: 'hello', new_string: 'goodbye' })
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

describe('run_file tool', () => {
  const skillDir = path.join(arcfsDir, 'profiles', 'eascoai-test', 'skills', 'using-excel')
  const skillDirUrl = 'arcfs://profiles/eascoai-test/skills/using-excel'
  const { run_file } = buildTools({
    skills: [{ name: 'using-excel', directory: skillDirUrl }],
    workspacePath,
  })

  beforeEach(async () => {
    mockExecFile.mockReset()
    mockExecFile.mockImplementation((_bin, _args, _opts, cb) => cb(null, 'ok', ''))
    await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true })
    await fs.writeFile(path.join(skillDir, 'scripts', 'xlsx.js'), '// script')
  })

  const nodeBootstrap = 'delete process.versions.electron;process.execArgv=[];require(process.argv[1])'

  test('node runner with file and args via shell', async () => {
    await run_file.execute({
      runner: 'node',
      file: 'scripts/xlsx.js',
      args: 'create /tmp/demo.xlsx --from /tmp/test-data.json',
      cwd: '$USING_EXCEL_SKILL_DIR',
    })
    expect(mockExecFile).toHaveBeenCalledWith(
      '/bin/sh',
      ['-c', expect.stringContaining('scripts/xlsx.js')],
      expect.objectContaining({
        cwd: skillDir,
        env: expect.objectContaining({
          ELECTRON_RUN_AS_NODE: '1',
          WORKSPACE: workspacePath,
          USING_EXCEL_SKILL_DIR: skillDir,
        }),
      }),
      expect.any(Function),
    )
    const command = mockExecFile.mock.calls[0][1][1]
    expect(command).toContain(`-e '${nodeBootstrap}'`)
    expect(command).toContain('create /tmp/demo.xlsx --from /tmp/test-data.json')
  })

  test('unquoted $WORKSPACE in args is expanded and shell-quoted', async () => {
    await run_file.execute({
      runner: 'node',
      file: 'scripts/xlsx.js',
      args: 'create $WORKSPACE/out.xlsx --from $WORKSPACE/data.json',
      cwd: '$USING_EXCEL_SKILL_DIR',
    })
    const command = mockExecFile.mock.calls[0][1][1]
    const q = workspacePath.replace(/'/g, "'\\''")
    expect(command).toContain(`'${q}'/out.xlsx`)
    expect(command).toContain(`'${q}'/data.json`)
  })

  test('freeform runner executes via shell', async () => {
    await run_file.execute({
      runner: 'python',
      file: 'scripts/xlsx.js',
      cwd: '$USING_EXCEL_SKILL_DIR',
    })
    expect(mockExecFile).toHaveBeenCalledWith(
      '/bin/sh',
      ['-c', expect.stringContaining("'python'")],
      expect.objectContaining({ cwd: skillDir }),
      expect.any(Function),
    )
  })

  test('rejects script outside trusted skill directories', async () => {
    const result = await run_file.execute({
      runner: 'node',
      file: '../../../etc/passwd',
      cwd: '$USING_EXCEL_SKILL_DIR',
    })
    expect(result).toBe('Script is outside trusted skill directories')
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  test('rejects invalid cwd', async () => {
    const result = await run_file.execute({
      runner: 'node',
      file: 'scripts/xlsx.js',
      cwd: '/tmp/evil',
    })
    expect(result).toBe('Invalid cwd: must be a skill directory')
    expect(mockExecFile).not.toHaveBeenCalled()
  })
})

describe('expandArgsVars', () => {
  const vars = { WORKSPACE: '/path/with spaces/ws', MY_SKILL_DIR: '/skill/dir' }

  test('expands unquoted $VAR with shell quoting', () => {
    expect(expandArgsVars('$WORKSPACE/file.txt', vars))
      .toBe("'/path/with spaces/ws'/file.txt")
  })

  test('expands ${VAR} syntax', () => {
    expect(expandArgsVars('${WORKSPACE}/file.txt', vars))
      .toBe("'/path/with spaces/ws'/file.txt")
  })

  test('leaves $VAR inside double quotes untouched', () => {
    expect(expandArgsVars('"$WORKSPACE/file.txt"', vars))
      .toBe('"$WORKSPACE/file.txt"')
  })

  test('leaves $VAR inside single quotes untouched', () => {
    expect(expandArgsVars("'$WORKSPACE/file.txt'", vars))
      .toBe("'$WORKSPACE/file.txt'")
  })

  test('leaves unknown vars untouched', () => {
    expect(expandArgsVars('$FOO/bar', vars)).toBe('$FOO/bar')
  })

  test('mixed quoted and unquoted', () => {
    const result = expandArgsVars('$WORKSPACE/a "$WORKSPACE/b" \'$WORKSPACE/c\'', vars)
    expect(result).toBe("'/path/with spaces/ws'/a \"$WORKSPACE/b\" '$WORKSPACE/c'")
  })

  test('multiple known vars', () => {
    const result = expandArgsVars('$WORKSPACE $MY_SKILL_DIR', vars)
    expect(result).toBe("'/path/with spaces/ws' '/skill/dir'")
  })

  test('empty args', () => {
    expect(expandArgsVars('', vars)).toBe('')
  })
})

describe('browser tool', () => {
  test('exists in built tools', () => {
    const tools = buildTools({ skills: [], workspacePath, tmpPath: '/tmp/session' })
    expect(tools.browser).toBeDefined()
    expect(tools.browser.execute).toBeDefined()
  })
})
