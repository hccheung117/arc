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

const mockRunAgent = vi.fn()
vi.mock('./subagent.js', () => ({
  runAgent: (...args) => mockRunAgent(...args),
}))

const mockReadUIMessageStream = vi.fn()
vi.mock('ai', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, readUIMessageStream: (...args) => mockReadUIMessageStream(...args) }
})

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

  test('freeform runner executes via shell unquoted', async () => {
    await run_file.execute({
      runner: 'python',
      file: 'scripts/xlsx.js',
      cwd: '$USING_EXCEL_SKILL_DIR',
    })
    const command = mockExecFile.mock.calls[0][1][1]
    expect(command).toMatch(/^python '/)
  })

  test('multi-word runner passes through unquoted', async () => {
    await run_file.execute({
      runner: 'uv run',
      file: 'scripts/xlsx.js',
      args: '--verbose',
      cwd: '$USING_EXCEL_SKILL_DIR',
    })
    const command = mockExecFile.mock.calls[0][1][1]
    expect(command).toMatch(/^uv run '/)
    expect(command).toContain('scripts/xlsx.js')
  })

  test('rejects runner with shell metacharacters', async () => {
    const result = await run_file.execute({
      runner: 'uv run; rm -rf /',
      file: 'scripts/xlsx.js',
      cwd: '$USING_EXCEL_SKILL_DIR',
    })
    expect(result).toBe('Invalid runner: contains unsupported characters')
    expect(mockExecFile).not.toHaveBeenCalled()
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

describe('subagent tool', () => {
  const agents = [{ name: 'reviewer', description: 'Reviews code', model: null, file: 'reviewer.md', directory: 'arcfs://agents' }]

  test('not included when agents is empty', () => {
    const tools = buildTools({ skills: [], workspacePath, agents: [] })
    expect(tools.subagent).toBeUndefined()
  })

  test('not included when agents is undefined', () => {
    const tools = buildTools({ skills: [], workspacePath })
    expect(tools.subagent).toBeUndefined()
  })

  test('included when agents are provided', () => {
    const tools = buildTools({ skills: [], workspacePath, agents })
    expect(tools.subagent).toBeDefined()
    expect(tools.subagent.execute).toBeDefined()
  })

  describe('toModelOutput', () => {
    test('extracts last text part from message', () => {
      const { subagent } = buildTools({ skills: [], workspacePath, agents })
      const result = subagent.toModelOutput({
        output: { parts: [{ type: 'text', text: 'thinking...' }, { type: 'tool-invocation' }, { type: 'text', text: 'final answer' }] },
      })
      expect(result).toEqual({ type: 'text', value: 'final answer' })
    })

    test('falls back when no text parts', () => {
      const { subagent } = buildTools({ skills: [], workspacePath, agents })
      const result = subagent.toModelOutput({ output: { parts: [{ type: 'tool-invocation' }] } })
      expect(result).toEqual({ type: 'text', value: 'Task completed.' })
    })

    test('falls back when output is null', () => {
      const { subagent } = buildTools({ skills: [], workspacePath, agents })
      const result = subagent.toModelOutput({ output: null })
      expect(result).toEqual({ type: 'text', value: 'Task completed.' })
    })
  })

  describe('execute', () => {
    const fakeMessage = { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'done' }] }

    beforeEach(() => {
      mockRunAgent.mockReset()
      mockReadUIMessageStream.mockReset()
      mockRunAgent.mockResolvedValue({ toUIMessageStream: () => 'fake-stream' })
      mockReadUIMessageStream.mockReturnValue((async function* () { yield fakeMessage })())
    })

    test('calls runAgent with correct arguments', async () => {
      const provider = { id: 'test' }
      const { subagent } = buildTools({ skills: [], agents, provider, modelId: 'test-model', workspacePath })

      const gen = subagent.execute(
        { name: 'reviewer', prompt: 'review this', model: 'custom-model', skills: [] },
        { abortSignal: undefined },
      )
      for await (const _ of gen) { /* drain */ }

      expect(mockRunAgent).toHaveBeenCalledWith(expect.objectContaining({
        name: 'reviewer',
        prompt: 'review this',
        model: 'custom-model',
        agents,
        provider,
        modelId: 'test-model',
        signal: undefined,
      }))
    })

    test('passes all tools including subagent itself', async () => {
      const { subagent } = buildTools({ skills: [], agents, workspacePath })

      const gen = subagent.execute(
        { name: 'reviewer', prompt: 'test', skills: [] },
        { abortSignal: undefined },
      )
      for await (const _ of gen) {}

      const passedTools = mockRunAgent.mock.calls[0][0].tools
      expect(passedTools).toHaveProperty('read_file')
      expect(passedTools).toHaveProperty('list_dir')
      expect(passedTools).toHaveProperty('write_file')
      expect(passedTools).toHaveProperty('edit_file')
      expect(passedTools).toHaveProperty('load_skill')
      expect(passedTools).toHaveProperty('run_file')
      expect(passedTools).toHaveProperty('browser')
      expect(passedTools).toHaveProperty('subagent')
    })

    test('yields messages from stream', async () => {
      const msg1 = { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'first' }] }
      const msg2 = { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'second' }] }
      mockReadUIMessageStream.mockReturnValue((async function* () { yield msg1; yield msg2 })())

      const { subagent } = buildTools({ skills: [], agents, workspacePath })
      const gen = subagent.execute(
        { name: 'reviewer', prompt: 'test', skills: [] },
        { abortSignal: undefined },
      )

      const messages = []
      for await (const msg of gen) messages.push(msg)
      expect(messages).toEqual([msg1, msg2])
    })

    test('passes readUIMessageStream the stream from toUIMessageStream', async () => {
      const { subagent } = buildTools({ skills: [], agents, workspacePath })

      const gen = subagent.execute(
        { name: 'reviewer', prompt: 'test', skills: [] },
        { abortSignal: undefined },
      )
      for await (const _ of gen) {}

      expect(mockReadUIMessageStream).toHaveBeenCalledWith({ stream: 'fake-stream' })
    })

    test('passes all skills to runAgent', async () => {
      const skills = [
        { name: 'using-excel', directory: 'arcfs://skills/using-excel' },
        { name: 'using-artifact-devtools', directory: 'arcfs://skills/using-artifact-devtools' },
      ]
      const { subagent } = buildTools({ skills, agents, workspacePath })

      const gen = subagent.execute(
        { name: 'reviewer', prompt: 'test' },
        { abortSignal: undefined },
      )
      for await (const _ of gen) {}

      expect(mockRunAgent.mock.calls[0][0].allSkills).toBe(skills)
    })

    test('happy path: dispatch agent, stream result, extract output', async () => {
      const resultMessage = { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Review complete. 2 issues found.' }] }
      const fakeStream = { type: 'readable-stream' }
      mockRunAgent.mockResolvedValue({ toUIMessageStream: ({ sendReasoning }) => {
        expect(sendReasoning).toBe(true)
        return fakeStream
      }})
      mockReadUIMessageStream.mockReturnValue((async function* () { yield resultMessage })())

      const provider = { id: 'openai' }
      const { subagent } = buildTools({ skills: [], agents, provider, modelId: 'gpt-4', workspacePath })

      const gen = subagent.execute(
        { name: 'reviewer', prompt: 'Review src/main.js for bugs' },
        { abortSignal: undefined },
      )

      const messages = []
      for await (const msg of gen) messages.push(msg)

      // runAgent called with full context
      expect(mockRunAgent).toHaveBeenCalledOnce()
      expect(mockRunAgent.mock.calls[0][0]).toMatchObject({
        name: 'reviewer',
        prompt: 'Review src/main.js for bugs',
        provider,
        modelId: 'gpt-4',
      })
      // stream consumed correctly
      expect(mockReadUIMessageStream).toHaveBeenCalledWith({ stream: fakeStream })
      expect(messages).toEqual([resultMessage])
      // toModelOutput extracts the text
      const output = subagent.toModelOutput({ output: messages[0] })
      expect(output).toEqual({ type: 'text', value: 'Review complete. 2 issues found.' })
    })
  })
})
