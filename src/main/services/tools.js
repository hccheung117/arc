import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { tool } from 'ai'
import { z } from 'zod'
import { fromUrl } from '../arcfs.js'
import { loadSkillContent } from './skill.js'
import * as workspace from './workspace.js'

const SMALL_FILE_THRESHOLD = 500
const DEFAULT_PREVIEW_LINES = 200

const readFileContent = async (filePath, { offset, limit }) => {
  let stat
  try {
    stat = await fs.stat(filePath)
  } catch (e) {
    if (e.code === 'ENOENT') return `File not found: ${filePath}`
    if (e.code === 'EACCES') return `Permission denied: ${filePath}`
    return `Error reading file: ${filePath}`
  }

  if (stat.isDirectory()) return `Path is a directory, not a file: ${filePath}`

  let buf
  try {
    buf = await fs.readFile(filePath)
  } catch (e) {
    if (e.code === 'EACCES') return `Permission denied: ${filePath}`
    return `Error reading file: ${filePath}`
  }

  if (buf.includes(0)) return `Cannot read binary file: ${filePath}`

  const allLines = buf.toString('utf-8').split('\n')
  const totalLines = allLines.length

  const hasExplicit = offset != null || limit != null
  const fromLine = offset ?? 1
  if (fromLine > totalLines) return { content: '', totalLines, fromLine, toLine: fromLine }

  let selected
  if (hasExplicit) {
    selected = allLines.slice(fromLine - 1, limit != null ? fromLine - 1 + limit : undefined)
  } else if (totalLines <= SMALL_FILE_THRESHOLD) {
    selected = allLines
  } else {
    selected = allLines.slice(0, DEFAULT_PREVIEW_LINES)
  }

  const toLine = fromLine + selected.length - 1
  let content = selected.join('\n')

  if (!hasExplicit && totalLines > SMALL_FILE_THRESHOLD) {
    content += `\n--- File has ${totalLines.toLocaleString()} lines total (showing ${fromLine}–${toLine}). Use offset and limit to read more. ---`
  }

  return { content, totalLines, fromLine, toLine }
}

const resolvePath = async (rawPath) => {
  if (rawPath.startsWith('arcfs://')) return { path: fromUrl(rawPath) }
  const filePath = path.resolve(rawPath)
  if (!await workspace.isAllowed(filePath)) return { error: 'Access denied: not in workspace' }
  return { path: filePath }
}

const read_file = tool({
  description: 'Read a text file from arcfs or from workspace paths',
  inputSchema: z.object({
    path: z.string().describe('arcfs:// URL or absolute filesystem path'),
    offset: z.number().optional().describe('Line to start from (1-indexed)'),
    limit: z.number().optional().describe('Number of lines to return'),
  }),
  execute: async ({ path: rawPath, offset, limit }) => {
    const resolved = await resolvePath(rawPath)
    if (resolved.error) return resolved.error
    return readFileContent(resolved.path, { offset, limit })
  },
})

const list_dir = tool({
  description: 'List directory contents',
  inputSchema: z.object({
    path: z.string().describe('arcfs:// URL or absolute filesystem path'),
  }),
  execute: async ({ path: rawPath }) => {
    const resolved = await resolvePath(rawPath)
    if (resolved.error) return resolved.error
    let entries
    try {
      entries = await fs.readdir(resolved.path, { withFileTypes: true })
    } catch (e) {
      if (e.code === 'ENOENT') return `Not found: ${resolved.path}`
      if (e.code === 'ENOTDIR') return `Not a directory: ${resolved.path}`
      if (e.code === 'EACCES') return `Permission denied: ${resolved.path}`
      return `Error listing directory: ${resolved.path}`
    }
    const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
    const files = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))
    const result = []
    for (const d of dirs) result.push({ name: d.name, type: 'directory' })
    for (const f of files) {
      const stat = await fs.stat(path.join(resolved.path, f.name))
      result.push({ name: f.name, type: 'file', size: stat.size })
    }
    return result
  },
})

const write_file = tool({
  description: 'Create or overwrite a text file',
  inputSchema: z.object({
    path: z.string().describe('arcfs:// URL or absolute filesystem path'),
    content: z.string().describe('File content to write'),
  }),
  execute: async ({ path: rawPath, content }) => {
    const resolved = await resolvePath(rawPath)
    if (resolved.error) return resolved.error
    try {
      const existing = await fs.readFile(resolved.path)
      if (existing.includes(0)) return `Cannot overwrite binary file: ${resolved.path}`
    } catch { /* file doesn't exist yet — fine */ }
    await fs.mkdir(path.dirname(resolved.path), { recursive: true })
    const buf = Buffer.from(content, 'utf-8')
    await fs.writeFile(resolved.path, buf)
    return { path: resolved.path, bytesWritten: buf.length }
  },
})

const edit_file = tool({
  description: 'Search-and-replace in an existing file',
  inputSchema: z.object({
    path: z.string().describe('arcfs:// URL or absolute filesystem path'),
    old_string: z.string().describe('Text to find (must appear exactly once)'),
    new_string: z.string().describe('Replacement text'),
  }),
  execute: async ({ path: rawPath, old_string, new_string }) => {
    const resolved = await resolvePath(rawPath)
    if (resolved.error) return resolved.error
    let buf
    try {
      buf = await fs.readFile(resolved.path)
    } catch (e) {
      if (e.code === 'ENOENT') return `File not found: ${resolved.path}`
      return `Error reading file: ${resolved.path}`
    }
    if (buf.includes(0)) return `Cannot edit binary file: ${resolved.path}`
    const text = buf.toString('utf-8')
    const count = text.split(old_string).length - 1
    if (count === 0) return `String not found in file: ${resolved.path}`
    if (count > 1) return `String appears ${count} times — provide more context to disambiguate`
    await fs.writeFile(resolved.path, text.replace(old_string, new_string))
    return { path: resolved.path, replacements: 1 }
  },
})

export const buildTools = ({ skills }) => {
  const trustedDirs = skills.map(s => fromUrl(s.directory))

  const load_skill = tool({
    description: "Load a skill's full instructions by name",
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => loadSkillContent(skills, name),
  })

  const exec = tool({
    description: [
      'Run a script bundled with a skill.',
      'The command is split into a runner (the binary) and a script (path + args). Raw shell commands are not supported.',
      '',
      'Examples (bash → exec):',
      '  bash: node scripts/build.js --out dist',
      '  exec: runner="node", script="scripts/build.js --out dist"',
      '',
      '  bash: python3 scripts/analyze.py --verbose',
      '  exec: runner="python3", script="scripts/analyze.py --verbose"',
      '',
      '  bash: ./scripts/deploy.sh staging',
      '  exec: runner="native", script="scripts/deploy.sh staging"',
    ].join('\n'),
    inputSchema: z.object({
      runner: z.string().min(1).describe('The binary that executes the script. Use "node" for .js files, "native" for executables/shell scripts, or a binary name like "python3"'),
      script: z.string().describe('Script path relative to cwd, followed by space-separated arguments (e.g. "scripts/run.js --flag value")'),
      cwd: z.string().describe('Must be the arcfs:// URL from skillDirectory returned by load_skill'),
    }),
    execute: async ({ runner, script, cwd: rawCwd }) => {
      if (!rawCwd.startsWith('arcfs://')) return 'Invalid cwd: only arcfs:// URLs are accepted'
      const resolvedCwd = fromUrl(rawCwd)
      const [scriptPath, ...rawArgs] = script.split(' ')
      const resolved = path.resolve(resolvedCwd, scriptPath)
      const args = rawArgs.map(a => a.startsWith('arcfs://') ? fromUrl(a) : a)

      if (!trustedDirs.some(dir => resolved.startsWith(dir + path.sep)))
        return `Script is outside trusted skill directories`

      try { await fs.access(resolved) }
      catch { return `Script not found: ${scriptPath}` }

      if (runner === 'native' && process.platform !== 'win32')
        await fs.chmod(resolved, 0o755)

      const isNode = runner === 'node'
      const isNative = runner === 'native'
      const execBin = isNode ? process.execPath : isNative ? resolved : runner
      // Bootstrap via -e to clear process.versions.electron and execArgv so
      // Commander (and similar libs) use standard node argv parsing
      const nodeBootstrap = 'delete process.versions.electron;process.execArgv=[];require(process.argv[1])'
      const execArgs = isNative ? args : isNode ? ['-e', nodeBootstrap, resolved, ...args] : [resolved, ...args]
      const { NODE_OPTIONS, NODE_DEBUG, ...cleanEnv } = process.env
      const env = isNode ? { ...cleanEnv, ELECTRON_RUN_AS_NODE: '1' } : cleanEnv
      return new Promise((resolve) => {
        execFile(execBin, execArgs, { cwd: resolvedCwd, env }, (error, stdout, stderr) => {
          resolve({ stdout, stderr, exitCode: error ? error.code ?? 1 : 0 })
        })
      })
    },
  })

  return { read_file, list_dir, write_file, edit_file, load_skill, exec }
}
