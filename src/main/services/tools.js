import fs from 'node:fs/promises'
import { tool } from 'ai'
import { z } from 'zod'

const SMALL_FILE_THRESHOLD = 500
const DEFAULT_PREVIEW_LINES = 200

const read = tool({
  description: 'Read a text file from the filesystem',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    offset: z.number().optional().describe('Line to start from (1-indexed)'),
    limit: z.number().optional().describe('Number of lines to return'),
  }),
  execute: async ({ path, offset, limit }) => {
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

export const buildTools = () => ({ read })
