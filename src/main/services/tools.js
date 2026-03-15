import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { tool } from 'ai'
import { z } from 'zod'
import { fromUrl } from '../arcfs.js'
import { loadSkillContent } from './skill.js'

const SMALL_FILE_THRESHOLD = 500
const DEFAULT_PREVIEW_LINES = 200

const read = tool({
  description: 'Read a text file from the arcfs virtual filesystem',
  inputSchema: z.object({
    path: z.string().describe('arcfs:// URL of the file'),
    offset: z.number().optional().describe('Line to start from (1-indexed)'),
    limit: z.number().optional().describe('Number of lines to return'),
  }),
  execute: async ({ path: rawPath, offset, limit }) => {
    if (!rawPath.startsWith('arcfs://')) return 'Invalid path: only arcfs:// URLs are accepted'
    const path = fromUrl(rawPath)
    let stat
    try {
      stat = await fs.stat(path)
    } catch (e) {
      if (e.code === 'ENOENT') return `File not found: ${path}`
      if (e.code === 'EACCES') return `Permission denied: ${path}`
      return `Error reading file: ${path}`
    }

    if (stat.isDirectory()) return `Path is a directory, not a file: ${path}`

    let buf
    try {
      buf = await fs.readFile(path)
    } catch (e) {
      if (e.code === 'EACCES') return `Permission denied: ${path}`
      return `Error reading file: ${path}`
    }

    if (buf.includes(0)) return `Cannot read binary file: ${path}`

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
  },
})

const RUNNERS = {
  node: { bin: () => process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' }, platforms: null },
  bash: { bin: () => '/bin/bash', env: {}, platforms: new Set(['darwin', 'linux']) },
  powershell: { bin: () => 'powershell.exe', env: {}, platforms: new Set(['win32']) },
  native: { bin: null, env: {}, platforms: null },
}

export const buildTools = ({ skills }) => {
  const trustedDirs = skills.map(s => fromUrl(s.directory))

  const load_skill = tool({
    description: "Load a skill's full instructions by name",
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => loadSkillContent(skills, name),
  })

  const exec = tool({
    description: 'Run a script bundled with a skill',
    inputSchema: z.object({
      runner: z.enum(['node', 'bash', 'powershell', 'native']).describe('Which runner to use'),
      script: z.string().describe('Script path + args, relative to cwd'),
      cwd: z.string().describe('Skill directory as arcfs:// URL (skillDirectory from load_skill)'),
    }),
    execute: async ({ runner, script, cwd: rawCwd }) => {
      const cfg = RUNNERS[runner]
      if (cfg.platforms && !cfg.platforms.has(process.platform))
        return `${runner} is not available on ${process.platform}`

      if (!rawCwd.startsWith('arcfs://')) return 'Invalid cwd: only arcfs:// URLs are accepted'
      const resolvedCwd = fromUrl(rawCwd)
      const [scriptPath, ...args] = script.split(' ')
      const resolved = path.resolve(resolvedCwd, scriptPath)

      if (!trustedDirs.some(dir => resolved.startsWith(dir + path.sep)))
        return `Script is outside trusted skill directories`

      try { await fs.access(resolved) }
      catch { return `Script not found: ${scriptPath}` }

      if (runner === 'native' && process.platform !== 'win32')
        await fs.chmod(resolved, 0o755)

      const execBin = cfg.bin ? cfg.bin() : resolved
      const execArgs = cfg.bin ? [resolved, ...args] : args
      return new Promise((resolve) => {
        execFile(execBin, execArgs, {
          cwd: resolvedCwd,
          env: { ...process.env, ...cfg.env },
        }, (error, stdout, stderr) => {
          resolve({ stdout, stderr, exitCode: error ? error.code ?? 1 : 0 })
        })
      })
    },
  })

  return { read, load_skill, exec }
}
