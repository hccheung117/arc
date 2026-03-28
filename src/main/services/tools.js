import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { tool } from 'ai'
import { z } from 'zod'
import mime from 'mime'
import { resolve as arcfsResolve, fromUrl } from '../arcfs.js'
import { execute as browserExecute, setTmpPath } from './browser.js'
import { loadSkillContent, skillEnvName } from './skill.js'
import * as workspace from './workspace.js'

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

  const mediaType = mime.getType(filePath)
  if (mediaType?.startsWith('image/')) return { image: true, data: buf.toString('base64'), mediaType }

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

export const expandVars = (str, vars) =>
  str.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g,
    (m, a, b) => vars[a ?? b] ?? m)

const shellQuote = (s) => `'${s.replace(/'/g, "'\\''")}'`

const varPattern = /\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g

export const expandArgsVars = (args, vars) => {
  if (!args) return ''
  let quote = null
  let result = ''
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]
    if (ch === '\\') { result += ch + (args[++i] ?? ''); continue }
    if (quote === null && (ch === '"' || ch === "'")) { quote = ch; result += ch; continue }
    if (ch === quote) { quote = null; result += ch; continue }
    if (quote !== null) { result += ch; continue }
    // Unquoted $VAR or ${VAR}
    if (ch === '$') {
      varPattern.lastIndex = i
      const m = varPattern.exec(args)
      if (m && m.index === i) {
        const name = m[1] ?? m[2]
        if (name in vars) { result += shellQuote(vars[name]); i += m[0].length - 1; continue }
      }
    }
    result += ch
  }
  return result
}

export const buildTools = ({ skills, workspacePath, tmpPath }) => {
  const arcfsRoot = arcfsResolve()
  const trustedDirs = skills.map(s => fromUrl(s.directory))
  const vars = {}
  if (workspacePath) vars.WORKSPACE = workspacePath
  if (tmpPath) vars.SESSION_TMP = tmpPath
  for (const s of skills) vars[skillEnvName(s.name)] = fromUrl(s.directory)
  setTmpPath(tmpPath)

  const resolvePath = async (rawPath) => {
    const expanded = expandVars(rawPath, vars)
    const filePath = path.resolve(expanded)
    if (filePath.startsWith(arcfsRoot + path.sep) || filePath === arcfsRoot) return { path: filePath }
    if (trustedDirs.some(dir => filePath === dir || filePath.startsWith(dir + path.sep))) return { path: filePath }
    if (!await workspace.isAllowed(filePath)) return { error: 'Access denied: not in workspace' }
    return { path: filePath }
  }

  const read_file = tool({
    description: 'Read a text file or image',
    inputSchema: z.object({
      path: z.string().describe('Absolute filesystem path or $WORKSPACE / $..._SKILL_DIR path'),
      offset: z.number().optional().describe('Line to start from (1-indexed)'),
      limit: z.number().optional().describe('Number of lines to return'),
    }),
    execute: async ({ path: rawPath, offset, limit }) => {
      const resolved = await resolvePath(rawPath)
      if (resolved.error) return resolved.error
      return readFileContent(resolved.path, { offset, limit })
    },
    toModelOutput: ({ output }) => {
      if (!output?.image) return { type: 'text', value: typeof output === 'string' ? output : JSON.stringify(output) }
      return {
        type: 'content',
        value: [{ type: 'image-data', data: output.data, mediaType: output.mediaType }],
      }
    },
  })

  const list_dir = tool({
    description: 'List directory contents',
    inputSchema: z.object({
      path: z.string().describe('Absolute filesystem path or $WORKSPACE / $..._SKILL_DIR path'),
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
      const lines = [`BASE PATH: ${resolved.path}/`, '']
      for (const d of dirs) lines.push(`${d.name}/`)
      for (const f of files) {
        try {
          const stat = await fs.stat(path.join(resolved.path, f.name))
          lines.push(`${f.name}\t${formatSize(stat.size)}`)
        } catch {
          lines.push(`${f.name}\t(error)`)
        }
      }
      return lines.join('\n')
    },
  })

  const write_file = tool({
    description: 'Create or overwrite a text file',
    inputSchema: z.object({
      path: z.string().describe('Absolute filesystem path or $WORKSPACE / $..._SKILL_DIR path'),
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
      path: z.string().describe('Absolute filesystem path or $WORKSPACE / $..._SKILL_DIR path'),
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

  const load_skill = tool({
    description: "Load a skill's full instructions by name",
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => loadSkillContent(skills, name),
  })

  const run_file = tool({
    description: [
      'Run a script bundled with a skill.',
      'The command is split into a runner (the binary), a file (script path), and args. Raw shell commands are not supported.',
      '',
      'Examples (bash → run_file):',
      '  bash: node scripts/build.js --out dist',
      '  run_file: runner="node", file="scripts/build.js", args="--out dist"',
      '',
      '  bash: python3 scripts/analyze.py --verbose',
      '  run_file: runner="python3", file="scripts/analyze.py", args="--verbose"',
      '',
      '  bash: ./scripts/deploy.sh staging',
      '  run_file: runner="native", file="scripts/deploy.sh", args="staging"',
    ].join('\n'),
    inputSchema: z.object({
      runner: z.string().min(1).describe('The binary that executes the script. Use "node" for .js files, "native" for executables/shell scripts, or a binary name like "python3"'),
      file: z.string().describe('Script path relative to cwd (no arguments)'),
      args: z.string().optional().default('').describe('Arguments passed to the script. $WORKSPACE and $..._SKILL_DIR are expanded and shell-quoted automatically when unquoted.'),
      cwd: z.string().describe('Skill directory as env var (e.g. $USING_EXCEL_SKILL_DIR) from load_skill'),
    }),
    execute: async ({ runner, file, args, cwd: rawCwd }) => {
      const resolvedCwd = expandVars(rawCwd, vars)
      if (!trustedDirs.some(dir => resolvedCwd === dir || resolvedCwd.startsWith(dir + path.sep)))
        return 'Invalid cwd: must be a skill directory'
      const resolved = path.resolve(resolvedCwd, file)

      if (!trustedDirs.some(dir => resolved.startsWith(dir + path.sep)))
        return 'Script is outside trusted skill directories'

      try { await fs.access(resolved) }
      catch { return `Script not found: ${file}` }

      if (runner === 'native' && process.platform !== 'win32')
        await fs.chmod(resolved, 0o755)

      const isNode = runner === 'node'
      const isNative = runner === 'native'
      // Bootstrap via -e to clear process.versions.electron and execArgv so
      // Commander (and similar libs) use standard node argv parsing
      const nodeBootstrap = 'delete process.versions.electron;process.execArgv=[];require(process.argv[1])'
      const expanded = expandArgsVars(args, vars)
      const command = isNode
        ? `${shellQuote(process.execPath)} -e ${shellQuote(nodeBootstrap)} ${shellQuote(resolved)} ${expanded}`
        : isNative
          ? `${shellQuote(resolved)} ${expanded}`
          : `${shellQuote(runner)} ${shellQuote(resolved)} ${expanded}`

      const { NODE_OPTIONS, NODE_DEBUG, ...cleanEnv } = process.env
      const env = { ...cleanEnv, ...vars, ...(isNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}) }
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command]
      return new Promise((resolve) => {
        execFile(shell, shellArgs, { cwd: resolvedCwd, env }, (error, stdout, stderr) => {
          resolve({ stdout, stderr, exitCode: error ? error.code ?? 1 : 0 })
        })
      })
    },
  })

  const browser = tool({
    description: 'Control browser windows. Use load_skill("using-browser") for full command reference.',
    inputSchema: z.object({
      command: z.string().describe('Command name'),
      args: z.array(z.string()).optional().default([]).describe('Command arguments'),
    }),
    execute: async ({ command, args }) => browserExecute(command, args),
  })

  return { read_file, list_dir, write_file, edit_file, load_skill, run_file, browser }
}
